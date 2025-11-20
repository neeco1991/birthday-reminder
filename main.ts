import { Resend } from 'resend';

interface Friend {
  name: string;
  date: string | null;
  notification_before: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getFriends(): Friend[] {
  let envConfig = Deno.env.get('FRIENDS_CONFIG');

  if (!envConfig) {
    console.error('CRITICAL: FRIENDS_CONFIG environment variable is missing.');
    return [];
  }

  if (envConfig.startsWith("'") && envConfig.endsWith("'")) {
    envConfig = envConfig.slice(1, -1);
  }

  if (envConfig.startsWith('"') && envConfig.endsWith('"')) {
    envConfig = envConfig.slice(1, -1);
  }

  try {
    return JSON.parse(envConfig);
  } catch (e) {
    console.error('CRITICAL: Could not parse FRIENDS_CONFIG JSON.', e);
    return [];
  }
}

function createEmailTemplate(
  friendName: string,
  type: 'birthday' | 'advance' | 'milestone',
  extraData?: number | string
): { subject: string; html: string } {
  let subject = '';
  let title = '';
  let message = '';

  const containerStyle = `
    font-family: Arial, sans-serif;
    max-width: 600px;
    margin: 20px auto;
    border: 1px solid #D5DBDB;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    background-color: #F2F4F6;
  `;

  const headerStyle = `
    background-color: #3498DB;
    color: white;
    padding: 20px;
    text-align: center;
  `;

  const contentStyle = `
    padding: 30px;
    line-height: 1.6;
    color: #2C3E50;
  `;

  const footerStyle = `
    background-color: #EAECEE;
    color: #888;
    padding: 15px;
    text-align: center;
    font-size: 12px;
  `;

  if (type === 'milestone') {
    subject = `🚀 1000-Day Milestone: ${friendName} is ${extraData} days old!`;
    title = '🎉 Milestone Alert! 🎉';
    message = `Today <strong>${friendName}</strong> has been alive for exactly <strong>${extraData}</strong> days! How amazing is that?`;
  } else if (type === 'advance') {
    subject = `📅 Upcoming Birthday: ${friendName}`;
    title = '🎈 Birthday Reminder 🎈';
    const date = extraData?.toString().split('/').slice(0, 2).join('/');
    message = `Heads up! <strong>${friendName}</strong>'s birthday is just around the corner on ${date}. Time to get the confetti ready!`;
  } else {
    subject = `🎂 It's ${friendName}'s Birthday Today!`;
    title = "🥳 It's Party Time! 🥳";
    message = `Today is the day! Wish <strong>${friendName}</strong> a very happy birthday and make their day special.`;
  }

  const html = `
    <div style="${containerStyle}">
      <div style="${headerStyle}">
        <h1>${title}</h1>
      </div>
      <div style="${contentStyle}">
        <p>Hi there,</p>
        <p>${message}</p>
        <p>Best,</p>
        <p>Your Friendly Birthday Bot 🤖</p>
      </div>
      <div style="${footerStyle}">
        <p>This is an automated reminder. You can't reply to this email.</p>
      </div>
    </div>
  `;

  return { subject, html };
}

async function sendEmail(
  friend: Friend,
  type: 'birthday' | 'advance' | 'milestone',
  extraData?: number | string
) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const rawRecipients = Deno.env.get('NOTIFICATION_EMAIL');

  if (!apiKey) {
    console.error(`[ERROR] Missing RESEND_API_KEY.`);
    return;
  }

  if (!rawRecipients) {
    console.error(`[ERROR] Missing NOTIFICATION_EMAIL env var.`);
    return;
  }

  const recipients = rawRecipients.split(',').map((email) => email.trim());

  const resend = new Resend(apiKey);

  const { subject, html } = createEmailTemplate(friend.name, type, extraData);

  try {
    const res = await resend.emails.send({
      from: 'Birthday Bot <emailer@birthdayreminder.space>',
      to: recipients,
      subject: subject,
      html: html,
    });
    await sleep(2000);
    console.log({ res });
    console.log(`Email sent for ${friend.name} [${type}]`);
  } catch (error) {
    console.error(`Failed to send email for ${friend.name}`, error);
  }
}

async function checkDates() {
  const friends = getFriends();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`Running checks for ${today.toISOString().split('T')[0]}`);

  for (const friend of friends) {
    if (!friend.date) return;

    const parts = friend.date.split('/');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parts[2] ? parseInt(parts[2]) : null;

    const targetDate = new Date(today);
    let targetDay = targetDate.getDate();
    let targetMonth = targetDate.getMonth() + 1;

    if (targetDay === day && targetMonth === month) {
      await sendEmail(friend, 'birthday');
    }

    if (friend.notification_before > 0) {
      targetDate.setDate(today.getDate() + friend.notification_before);

      targetDay = targetDate.getDate();
      targetMonth = targetDate.getMonth() + 1;

      if (targetDay === day && targetMonth === month) {
        await sendEmail(friend, 'advance', friend.date);
      }
    }

    if (year) {
      const birthDate = new Date(year, month - 1, day);
      birthDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - birthDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0 && diffDays % 1000 === 0) {
        await sendEmail(friend, 'milestone', diffDays);
      }
    }
  }
}

// Deno.cron('Daily Checks', '0 8 * * *', checkDates);

Deno.serve((req) => {
  const url = new URL(req.url);
  if (url.pathname === '/check-now') {
    checkDates();
    return new Response('Manual check triggered');
  }

  const friends = getFriends();
  return new Response(`Birthday Bot Active. Loaded ${friends.length} friends.`);
});
