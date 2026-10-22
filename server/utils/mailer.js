const nodemailer = require('nodemailer');
const axios = require('axios');

// Configure reusable Gmail Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

let isBrevoDisabled = false;

// Non-blocking verification of Brevo API key on load
if (process.env.BREVO_API_KEY) {
  axios.get('https://api.brevo.com/v3/account', {
    headers: { 'api-key': process.env.BREVO_API_KEY },
    timeout: 5000
  }).then(() => {
    console.log('[Mailer] Brevo API authenticated successfully');
  }).catch((err) => {
    isBrevoDisabled = true;
    console.warn('[Mailer] Brevo API key is not enabled/valid. Defaulting to Gmail Nodemailer.');
  });
}

// Non-blocking verification of Gmail Nodemailer on load
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify((err) => {
    if (err) {
      console.warn('[Mailer] Nodemailer Gmail verification warning:', err.message);
    } else {
      console.log(`[Mailer] Nodemailer ready for ${process.env.EMAIL_USER}`);
    }
  });
}

/**
 * Universal email dispatcher:
 * 1. Attempts Brevo HTTP API (ideal for cloud/Render where SMTP ports are blocked) if key is enabled.
 * 2. If Brevo fails or is unauthorized, falls back automatically to Gmail Nodemailer.
 */
const sendEmail = async (toEmail, subject, htmlContent) => {
  const fromName = 'FeedForward';
  const fromEmail = process.env.EMAIL_USER || 'no-reply@feedforward.com';

  // 1. Try Brevo HTTP API if available
  if (process.env.BREVO_API_KEY && !isBrevoDisabled) {
    try {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            name: fromName,
            email: fromEmail
          },
          to: [{ email: toEmail }],
          subject: subject,
          htmlContent: htmlContent
        },
        {
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          },
          timeout: 8000
        }
      );
      console.log(`[Mailer] Email sent via Brevo to ${toEmail}`);
      return;
    } catch (error) {
      const errData = error.response ? error.response.data : error.message;
      console.warn('[Mailer] Brevo API Error:', errData);

      if (error.response?.status === 401 || error.response?.data?.code === 'unauthorized') {
        console.warn('[Mailer] Brevo API key not enabled. Disabling Brevo and switching to Gmail Nodemailer.');
        isBrevoDisabled = true;
      }
      console.log(`[Mailer] Falling back to Gmail Nodemailer for ${toEmail}...`);
    }
  }

  // 2. Fallback to Gmail Nodemailer
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent
      });
      console.log(`[Mailer] Email delivered via Gmail Nodemailer to ${toEmail} (${info.messageId})`);
      return info;
    } catch (smtpError) {
      console.error('[Mailer] Gmail Nodemailer Error:', smtpError.message);
      throw smtpError;
    }
  }

  throw new Error('No working email provider available. Configure EMAIL_USER & EMAIL_PASS or a valid BREVO_API_KEY in server/.env');
};

// Aliased for backward compatibility with existing code
const sendBrevoEmail = sendEmail;

const sendFoodPostNotification = async ({ adminEmail, donorName, foodName, quantity, locationAddress }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🍱 New Food Donation Posted — ${foodName}`;
  const html = `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif;">🌱 New Food Donation Alert</h2>
        <p style="color: #264653;">A new food donation has been posted on <strong>FeedForward</strong>.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #F4A261;">
          <p><strong>Donor:</strong> ${donorName}</p>
          <p><strong>Food:</strong> ${foodName}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Location:</strong> ${locationAddress || 'See map in dashboard'}</p>
        </div>
        <p style="margin-top: 16px; color: #264653;">Please log in to your <strong>NGO Admin Dashboard</strong> to accept and assign a delivery agent.</p>
        <a href="${clientUrl}/admin" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #2D6A4F; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Dashboard</a>
      </div>
  `;
  await sendEmail(adminEmail, subject, html);
};

const sendAgentAssignmentNotification = async ({ agentEmail, agentName, donorName, foodName, address, pickupTime }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🚴 New Delivery Assignment — ${foodName}`;
  const html = `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif;">🚴 You Have a New Delivery!</h2>
        <p style="color: #264653;">Hi <strong>${agentName}</strong>, you have been assigned a new delivery on <strong>FeedForward</strong>.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #F4A261;">
          <p><strong>Donor:</strong> ${donorName}</p>
          <p><strong>Food:</strong> ${foodName}</p>
          <p><strong>Pickup Address:</strong> ${address || 'Check dashboard for location'}</p>
          <p><strong>Posted at:</strong> ${new Date(pickupTime).toLocaleString()}</p>
        </div>
        <p style="margin-top: 16px; color: #264653;">Please open your <strong>Agent Dashboard</strong> to accept and start navigation.</p>
        <a href="${clientUrl}/agent" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #F4A261; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Dashboard</a>
      </div>
  `;
  await sendEmail(agentEmail, subject, html);
};

const sendPasswordResetEmail = async (email, tempPassword) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🔐 Password Reset Request`;
  const html = `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif;">🔐 Password Reset</h2>
        <p style="color: #264653;">You requested a password reset for your <strong>FeedForward</strong> account.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #FC8019;">
          <p>Your temporary password is: <strong style="font-size: 18px; color: #FC8019;">${tempPassword}</strong></p>
        </div>
        <p style="margin-top: 16px; color: #264653;">Please log in with this temporary password and update it immediately in your Profile settings.</p>
        <a href="${clientUrl}/login" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #FC8019; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Login</a>
      </div>
  `;
  await sendEmail(email, subject, html);
};

const sendDonationThankYouEmail = async ({ donorEmail, donorName, foodName }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🎉 Thank You for Your Donation!`;
  const html = `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif;">🎉 Delivery Completed!</h2>
        <p style="color: #264653;">Hi <strong>${donorName}</strong>, your generous donation of <strong>${foodName}</strong> has been successfully delivered to those in need.</p>
        <p style="color: #264653;">Thank you for making a difference and helping reduce food waste. Your contribution is highly appreciated!</p>
        <a href="${clientUrl}/donor" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #2D6A4F; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">View Dashboard</a>
      </div>
  `;
  await sendEmail(donorEmail, subject, html);
};

const sendFoodPostAlertToSuperAdmin = async ({ superAdminEmail, donorName, foodName, quantity, targetName, locationAddress }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `👑 [SuperAdmin Alert] New Food Donation — ${foodName}`;
  const html = `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #F4F6FB; border-radius: 12px; border: 1px solid #E1E6F0;">
        <h2 style="color: #282C3F; font-family: serif;">👑 SuperAdmin Food Donation Notification</h2>
        <p style="color: #555;">A new donation has been submitted on <strong>FeedForward</strong>.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #5856D6;">
          <p><strong>Donor:</strong> ${donorName}</p>
          <p><strong>Food Item:</strong> ${foodName}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Assigned To:</strong> ${targetName || 'Open to All NGOs (Broadcast)'}</p>
          <p><strong>Pickup Location:</strong> ${locationAddress || 'View on live map'}</p>
        </div>
        <p style="margin-top: 16px; color: #555;">You can monitor or manage this post in the SuperAdmin Command Center.</p>
        <a href="${clientUrl}/admin/superadmin" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #5856D6; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open SuperAdmin Panel</a>
      </div>
  `;
  await sendEmail(superAdminEmail, subject, html);
};

const sendBroadcastFoodPostNotification = async ({ adminEmail, donorName, foodName, quantity, locationAddress }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `📢 Open Food Donation Alert — ${foodName}`;
  const html = `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif;">📢 New Open Donation for All NGOs</h2>
        <p style="color: #264653;">A donor has published an <strong>Open Food Donation</strong> accessible to all registered NGOs.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #FC8019;">
          <p><strong>Donor:</strong> ${donorName}</p>
          <p><strong>Food:</strong> ${foodName}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Location:</strong> ${locationAddress || 'Check dashboard map'}</p>
        </div>
        <p style="margin-top: 16px; color: #264653;">First NGO to accept will be assigned this donation. Log in now to claim and assign an agent!</p>
        <a href="${clientUrl}/admin/requests" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #FC8019; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Claim Donation Now</a>
      </div>
  `;
  await sendEmail(adminEmail, subject, html);
};

module.exports = {
  sendFoodPostNotification,
  sendAgentAssignmentNotification,
  sendPasswordResetEmail,
  sendDonationThankYouEmail,
  sendFoodPostAlertToSuperAdmin,
  sendBroadcastFoodPostNotification
};
