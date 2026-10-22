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

// If the BREVO_API_KEY is the unactivated test key or not provided, disable Brevo proactively
if (!process.env.BREVO_API_KEY || process.env.BREVO_API_KEY.includes('xkeysib-26e3f836fc72c01384d95bb0fe53239753c83973dab419cec5095648197ee4a9')) {
  isBrevoDisabled = true;
  console.log('[Mailer] Inactive Brevo API key detected. Defaulting directly to Gmail Nodemailer.');
} else {
  // Non-blocking verification of Brevo API key on load
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
 * - Redirects dummy test domains (@feedforward.com, @example.com) to process.env.EMAIL_USER
 *   so demo notifications actually arrive in the developer's real inbox!
 * - Attempts Brevo HTTP API if enabled.
 * - Falls back to Gmail Nodemailer reliably.
 */
const sendEmail = async (toEmail, subject, htmlContent) => {
  const fromName = 'FeedForward';
  const fromEmail = process.env.EMAIL_USER || 'no-reply@feedforward.com';

  // Smart redirect: If recipient is a placeholder or fake domain, route to real configured admin email
  let actualRecipient = toEmail;
  let routedNotice = '';
  if (toEmail.includes('@feedforward.com') || toEmail.includes('@example.com') || toEmail.includes('@codeviit.com')) {
    if (process.env.EMAIL_USER) {
      actualRecipient = process.env.EMAIL_USER;
      routedNotice = `<div style="background: #FFF3CD; color: #856404; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; border: 1px solid #FFEEBA;">
        🔔 <strong>Demo Notification Notice:</strong> This email was originally targeted to <code>${toEmail}</code> and automatically routed to your inbox (<code>${actualRecipient}</code>) for live demo/testing.
      </div>`;
    }
  }

  const finalHtml = routedNotice ? `${routedNotice}${htmlContent}` : htmlContent;

  // 1. Try Brevo HTTP API if available and enabled
  if (process.env.BREVO_API_KEY && !isBrevoDisabled) {
    try {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            name: fromName,
            email: fromEmail
          },
          to: [{ email: actualRecipient }],
          subject: subject,
          htmlContent: finalHtml
        },
        {
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          },
          timeout: 6000
        }
      );
      console.log(`[Mailer] Email sent via Brevo to ${actualRecipient}`);
      return;
    } catch (error) {
      const errData = error.response ? error.response.data : error.message;
      console.warn('[Mailer] Brevo API Error:', errData);

      if (error.response?.status === 401 || error.response?.data?.code === 'unauthorized') {
        console.warn('[Mailer] Brevo API key not enabled. Disabling Brevo and switching to Gmail Nodemailer.');
        isBrevoDisabled = true;
      }
      console.log(`[Mailer] Falling back to Gmail Nodemailer for ${actualRecipient}...`);
    }
  }

  // 2. Reliable Fallback to Gmail Nodemailer
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: actualRecipient,
        subject: subject,
        html: finalHtml
      });
      console.log(`[Mailer] Email delivered via Gmail Nodemailer to ${actualRecipient} (${info.messageId})`);
      return info;
    } catch (smtpError) {
      console.error('[Mailer] Gmail Nodemailer Error:', smtpError.message);
      throw smtpError;
    }
  }

  throw new Error('No working email provider available. Configure EMAIL_USER & EMAIL_PASS in server/.env');
};

// Aliased for backward compatibility with existing code
const sendBrevoEmail = sendEmail;

const sendFoodPostNotification = async ({ adminEmail, donorName, foodName, quantity, locationAddress }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🍱 New Food Donation Posted — ${foodName}`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif; margin-top: 0;">🌱 New Food Donation Alert</h2>
        <p style="color: #264653;">A new food donation has been posted on <strong>FeedForward</strong>.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #F4A261; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 6px 0;"><strong>Donor:</strong> ${donorName}</p>
          <p style="margin: 6px 0;"><strong>Food:</strong> ${foodName}</p>
          <p style="margin: 6px 0;"><strong>Quantity:</strong> ${quantity}</p>
          <p style="margin: 6px 0;"><strong>Location:</strong> ${locationAddress || 'See map in dashboard'}</p>
        </div>
        <p style="margin-top: 18px; color: #264653;">Please log in to your <strong>NGO Admin Dashboard</strong> to accept and assign a delivery agent.</p>
        <a href="${clientUrl}/admin" style="display: inline-block; margin-top: 8px; padding: 12px 28px; background: #2D6A4F; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open NGO Dashboard</a>
      </div>
  `;
  await sendEmail(adminEmail, subject, html);
};

const sendDonorPostConfirmationEmail = async ({ donorEmail, donorName, foodName, quantity, address, expiryTime }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🍱 Donation Confirmed: "${foodName}" is Live on FeedForward`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif; margin-top: 0;">🎉 Thank You for Sharing Food, ${donorName}!</h2>
        <p style="color: #264653;">Your generous donation of <strong>${foodName}</strong> (${quantity}) has been successfully posted to our verified NGO network.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #2D6A4F; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 6px 0;"><strong>Food Item:</strong> ${foodName}</p>
          <p style="margin: 6px 0;"><strong>Quantity:</strong> ${quantity}</p>
          <p style="margin: 6px 0;"><strong>Pickup Address:</strong> ${address || 'Location provided'}</p>
          ${expiryTime ? `<p style="margin: 6px 0;"><strong>Best Before:</strong> ${new Date(expiryTime).toLocaleString()}</p>` : ''}
          <p style="margin: 6px 0;"><strong>Status:</strong> <span style="background: #E8F5E9; color: #2E7D32; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Pending NGO Claim</span></p>
        </div>
        <p style="margin-top: 18px; color: #264653;">You will receive live tracking updates once an NGO accepts your donation and dispatches a delivery agent.</p>
        <a href="${clientUrl}/donor" style="display: inline-block; margin-top: 8px; padding: 12px 28px; background: #2D6A4F; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Track Your Donation</a>
      </div>
  `;
  await sendEmail(donorEmail, subject, html);
};

const sendAgentAssignmentNotification = async ({ agentEmail, agentName, donorName, foodName, address, pickupTime }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🚴 New Delivery Assignment — ${foodName}`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif; margin-top: 0;">🚴 You Have a New Delivery!</h2>
        <p style="color: #264653;">Hi <strong>${agentName}</strong>, you have been assigned a new delivery on <strong>FeedForward</strong>.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #F4A261; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 6px 0;"><strong>Donor:</strong> ${donorName}</p>
          <p style="margin: 6px 0;"><strong>Food:</strong> ${foodName}</p>
          <p style="margin: 6px 0;"><strong>Pickup Address:</strong> ${address || 'Check dashboard for location'}</p>
          <p style="margin: 6px 0;"><strong>Posted at:</strong> ${new Date(pickupTime).toLocaleString()}</p>
        </div>
        <p style="margin-top: 18px; color: #264653;">Please open your <strong>Agent Dashboard</strong> to accept and start navigation.</p>
        <a href="${clientUrl}/agent" style="display: inline-block; margin-top: 8px; padding: 12px 28px; background: #F4A261; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Agent Dashboard</a>
      </div>
  `;
  await sendEmail(agentEmail, subject, html);
};

const sendPasswordResetEmail = async (email, tempPassword) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🔐 Password Reset Request — FeedForward`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif; margin-top: 0;">🔐 Password Reset</h2>
        <p style="color: #264653;">You requested a password reset for your <strong>FeedForward</strong> account.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #FC8019; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 4px 0;">Your temporary password is:</p>
          <div style="font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #FC8019; margin: 10px 0;">${tempPassword}</div>
        </div>
        <p style="margin-top: 18px; color: #264653;">Please log in with this temporary password and update it immediately in your Profile settings.</p>
        <a href="${clientUrl}/login" style="display: inline-block; margin-top: 8px; padding: 12px 28px; background: #FC8019; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Login</a>
      </div>
  `;
  await sendEmail(email, subject, html);
};

const sendDonationThankYouEmail = async ({ donorEmail, donorName, foodName }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🎉 Thank You for Your Donation! — FeedForward`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif; margin-top: 0;">🎉 Delivery Completed!</h2>
        <p style="color: #264653;">Hi <strong>${donorName}</strong>, your generous donation of <strong>${foodName}</strong> has been successfully delivered to those in need.</p>
        <p style="color: #264653;">Thank you for making a difference and helping reduce food waste. Your contribution has earned reward points on FeedForward!</p>
        <a href="${clientUrl}/donor" style="display: inline-block; margin-top: 8px; padding: 12px 28px; background: #2D6A4F; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">View Your Impact & Points</a>
      </div>
  `;
  await sendEmail(donorEmail, subject, html);
};

const sendFoodPostAlertToSuperAdmin = async ({ superAdminEmail, donorName, foodName, quantity, targetName, locationAddress }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `👑 [SuperAdmin Alert] New Food Donation — ${foodName}`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #F4F6FB; border-radius: 12px; border: 1px solid #E1E6F0;">
        <h2 style="color: #282C3F; font-family: serif; margin-top: 0;">👑 SuperAdmin Food Donation Alert</h2>
        <p style="color: #555;">A new food donation has been submitted on <strong>FeedForward</strong>.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #5856D6; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 6px 0;"><strong>Donor:</strong> ${donorName}</p>
          <p style="margin: 6px 0;"><strong>Food Item:</strong> ${foodName}</p>
          <p style="margin: 6px 0;"><strong>Quantity:</strong> ${quantity}</p>
          <p style="margin: 6px 0;"><strong>Assigned To:</strong> ${targetName || 'Open to All NGOs (Broadcast)'}</p>
          <p style="margin: 6px 0;"><strong>Pickup Location:</strong> ${locationAddress || 'View on live map'}</p>
        </div>
        <p style="margin-top: 18px; color: #555;">You can monitor or manage this post in the SuperAdmin Command Center.</p>
        <a href="${clientUrl}/admin/superadmin" style="display: inline-block; margin-top: 8px; padding: 12px 28px; background: #5856D6; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open SuperAdmin Panel</a>
      </div>
  `;
  await sendEmail(superAdminEmail, subject, html);
};

const sendBroadcastFoodPostNotification = async ({ adminEmail, donorName, foodName, quantity, locationAddress }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `📢 Open Food Donation Alert — ${foodName}`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif; margin-top: 0;">📢 New Open Donation for All NGOs</h2>
        <p style="color: #264653;">A donor has published an <strong>Open Food Donation</strong> accessible to all registered NGOs.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #FC8019; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 6px 0;"><strong>Donor:</strong> ${donorName}</p>
          <p style="margin: 6px 0;"><strong>Food:</strong> ${foodName}</p>
          <p style="margin: 6px 0;"><strong>Quantity:</strong> ${quantity}</p>
          <p style="margin: 6px 0;"><strong>Location:</strong> ${locationAddress || 'Check dashboard map'}</p>
        </div>
        <p style="margin-top: 18px; color: #264653;">First NGO to accept will be assigned this donation. Log in now to claim and assign an agent!</p>
        <a href="${clientUrl}/admin/requests" style="display: inline-block; margin-top: 8px; padding: 12px 28px; background: #FC8019; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Claim Donation Now</a>
      </div>
  `;
  await sendEmail(adminEmail, subject, html);
};

const sendCitizenRequestNotification = async ({ recipientEmail, name, phone, mealsNeeded, dietaryType, needType, notes, address, pin, navigationUrl }) => {
  const targetEmail = recipientEmail || process.env.EMAIL_USER || 'muralipatnala24@gmail.com';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const subject = `🆘 [Citizen Food Alert] New Request from ${name} (${mealsNeeded} Meals, PIN: ${pin})`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FFF5F5; border-radius: 12px; border: 1px solid #FED7D7;">
        <h2 style="color: #C53030; font-family: serif; margin-top: 0;">🆘 Urgent Citizen Food Assistance Request</h2>
        <p style="color: #2D3748;">A community member has requested immediate meal support via the public FeedForward portal.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #E53E3E; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 6px 0;"><strong>Citizen Name:</strong> ${name}</p>
          <p style="margin: 6px 0;"><strong>Phone / Contact:</strong> <a href="tel:${phone}" style="color: #2B6CB0; text-decoration: underline;">${phone}</a></p>
          <p style="margin: 6px 0;"><strong>Meals Requested:</strong> ${mealsNeeded} (${dietaryType.toUpperCase()} - ${needType})</p>
          <p style="margin: 6px 0;"><strong>Location / Address:</strong> ${address || 'Local area GPS coordinates recorded'}</p>
          <p style="margin: 6px 0;"><strong>4-Digit Delivery Verification PIN:</strong> <span style="font-size: 18px; font-weight: bold; background: #FEFCBF; color: #B7791F; padding: 2px 8px; border-radius: 4px;">${pin}</span></p>
          ${notes ? `<p style="margin: 6px 0;"><strong>Special Notes:</strong> <em>${notes}</em></p>` : ''}
        </div>
        ${navigationUrl ? `
          <div style="margin-top: 16px; text-align: center;">
            <a href="${navigationUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #3182CE; color: white; border-radius: 8px; text-decoration: none; font-weight: bold;">📍 Open Live Google Maps Navigation</a>
          </div>
        ` : ''}
        <p style="margin-top: 18px; color: #4A5568; font-size: 13px;">Manage this request in the SuperAdmin Command Center or NGO Admin Portal to allocate surplus food.</p>
        <div style="text-align: center; margin-top: 12px;">
          <a href="${clientUrl}/admin/superadmin" style="display: inline-block; padding: 10px 22px; background: #2D3748; color: white; border-radius: 6px; text-decoration: none; font-size: 14px;">Review in Admin Panel</a>
        </div>
      </div>
  `;
  await sendEmail(targetEmail, subject, html);
};

const sendWelcomeEmail = async ({ email, name, role }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const roleTitle = role === 'donor' ? 'Food Donor Hero' : (role === 'admin' ? 'NGO Partner' : (role === 'agent' ? 'Delivery Agent' : 'Community Member'));
  const subject = `🌱 Welcome to FeedForward, ${name}!`;
  const html = `
      <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FEFAE0; border-radius: 12px;">
        <h2 style="color: #2D6A4F; font-family: serif; margin-top: 0;">🌱 Welcome to FeedForward!</h2>
        <p style="color: #264653;">Hi <strong>${name}</strong>, thank you for joining FeedForward as a <strong>${roleTitle}</strong>.</p>
        <div style="background: white; padding: 18px; border-radius: 8px; border-left: 4px solid #2D6A4F; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <p style="margin: 6px 0; color: #264653;">Together, we bridge the gap between surplus food and hunger. Every meal rescued reduces greenhouse gas emissions and directly feeds families in need.</p>
        </div>
        <div style="margin-top: 20px;">
          <a href="${clientUrl}/login" style="display: inline-block; padding: 12px 28px; background: #2D6A4F; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Your Dashboard</a>
        </div>
      </div>
  `;
  await sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendBrevoEmail,
  sendFoodPostNotification,
  sendDonorPostConfirmationEmail,
  sendAgentAssignmentNotification,
  sendPasswordResetEmail,
  sendDonationThankYouEmail,
  sendFoodPostAlertToSuperAdmin,
  sendBroadcastFoodPostNotification,
  sendCitizenRequestNotification,
  sendWelcomeEmail
};
