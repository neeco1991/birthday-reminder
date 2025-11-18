import { Resend } from 'resend';

interface Friend {
  name: string;
  date: string | null;
  notification_before: number;
}

function getFriends(): Friend[] {
  const envConfig = Deno.env.get('FRIENDS_LIST');

  if (!envConfig) {
    console.error('CRITICAL: FRIENDS_LIST environment variable is missing.');
    return [];
  }

  try {
    return JSON.parse(envConfig);
  } catch (e) {
    console.error('CRITICAL: Could not parse FRIENDS_LIST JSON.', e);
    return [];
  }
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

async function sendEmail(
  friend: Friend,
  type: 'birthday' | 'advance' | 'milestone',
  extraData?: number
) {
  if (!Deno.env.get('RESEND_API_KEY')) {
    console.log(`[DRY RUN] Sending ${type} email for ${friend.name}`);
    return;
  }

  let subject = '';
  let html = '';

  if (type === 'milestone') {
    subject = `🚀 1000-Day Milestone: ${friend.name} is ${extraData} days old!`;
    html = `<p>Today <strong>${friend.name}</strong> has been alive for exactly <strong>${extraData}</strong> days!</p>`;
  } else if (type === 'advance') {
    subject = `📅 Upcoming Birthday: ${friend.name}`;
    html = `<p>Heads up! <strong>${friend.name}</strong> has a birthday coming up on ${friend.date}.</p>`;
  } else {
    subject = `🎂 It's ${friend.name}'s Birthday Today!`;
    html = `<p>Today is the day! Wish <strong>${friend.name}</strong> a happy birthday!</p>`;
  }

  try {
    await resend.emails.send({
      from: 'Birthday Bot <onboarding@resend.dev>',
      to: ['nicolascionti.dev@gmail.com'],
      subject: subject,
      html: html,
    });
    console.log(`Email sent for ${friend.name} [${type}]`);
  } catch (error) {
    console.error(`Failed to send email for ${friend.name}`, error);
  }
}

function checkDates() {
  const friends = getFriends();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`Running checks for ${today.toISOString().split('T')[0]}`);

  console.log(friends[2]);
  friends.forEach((friend) => {
    if (!friend.date) return;

    const parts = friend.date.split('/');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parts[2] ? parseInt(parts[2]) : null;

    const targetDate = new Date(today);
    let targetDay = targetDate.getDate();
    let targetMonth = targetDate.getMonth() + 1;

    if (targetDay === day && targetMonth === month) {
      sendEmail(friend, 'birthday');
    }

    if (friend.notification_before > 0) {
      targetDate.setDate(today.getDate() + friend.notification_before);

      targetDay = targetDate.getDate();
      targetMonth = targetDate.getMonth() + 1;

      if (targetDay === day && targetMonth === month) {
        sendEmail(friend, 'advance');
      }
    }

    if (year) {
      const birthDate = new Date(year, month - 1, day);
      birthDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - birthDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0 && diffDays % 1000 === 0) {
        sendEmail(friend, 'milestone', diffDays);
      }
    }
  });
}

Deno.cron('Daily Checks', '0 8 * * *', checkDates);

Deno.serve((req) => {
  const url = new URL(req.url);
  if (url.pathname === '/check-now') {
    checkDates();
    return new Response('Manual check triggered');
  }

  const friends = getFriends();
  return new Response(`Birthday Bot Active. Loaded ${friends.length} friends.`);
});
