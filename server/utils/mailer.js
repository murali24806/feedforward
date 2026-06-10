const axios = require('axios');

const sendBrevoEmail = async (toEmail, subject, htmlContent) => {
  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'FeedForward',
          email: process.env.EMAIL_USER // This must be the email you verified on Brevo
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
        }
      }
    );
  } catch (error) {
    console.error("Brevo API Error:", error.response ? error.response.data : error.message);
    throw error;
  }
};

const sendFoodPostNotification = async ({ adminEmail, donorName, foodName, quantity, locationAddress }) => {
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
        <a href="${process.env.CLIENT_URL}/admin" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #2D6A4F; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Dashboard</a>
      </div>
  `;
  await sendBrevoEmail(adminEmail, subject, html);
};

const sendAgentAssignmentNotification = async ({ agentEmail, agentName, donorName, foodName, address, pickupTime }) => {
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
        <a href="${process.env.CLIENT_URL}/agent" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #F4A261; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Dashboard</a>
      </div>
  `;
  await sendBrevoEmail(agentEmail, subject, html);
};

module.exports = { sendFoodPostNotification, sendAgentAssignmentNotification };
