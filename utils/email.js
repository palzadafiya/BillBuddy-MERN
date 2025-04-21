const axios = require('axios');

const sendSettlementEmail = async (group, balances) => {
  try {
    const members = group.members.map(member => member.user.email);
    const subject = `Settlement Summary for ${group.name}`;

    // Create email body
    let body = `<h2>Settlement Summary for ${group.name}</h2>`;
    body += '<h3>Final Balances:</h3><ul>';

    // Add balances to email body
    Object.entries(balances).forEach(([userId, balance]) => {
      const member = group.members.find(m => m.user._id.toString() === userId);
      if (member) {
        const name = member.user.name;
        if (balance > 0) {
          body += `<li>${name} is owed Rs. ${balance.toFixed(2)}</li>`;
        } else if (balance < 0) {
          body += `<li>${name} owes Rs. ${Math.abs(balance).toFixed(2)}</li>`;
        } else {
          body += `<li>${name} is settled up</li>`;
        }
      }
    });

    body += '</ul>';
    body += '<p>Thank you for using BillBuddy!</p>';

    // Send email using Web3Forms
    const response = await axios.post('https://api.web3forms.com/submit', {
      access_key: process.env.WEB3FORMS_ACCESS_KEY,
      subject,
      from_name: 'BillBuddy',
      from_email: 'noreply@billbuddy.com',
      to: members.join(','),
      body,
      reply_to: 'noreply@billbuddy.com'
    });

    if (response.data.success) {
      console.log('Settlement emails sent successfully');
    } else {
      throw new Error('Failed to send settlement emails');
    }
  } catch (error) {
    console.error('Error sending settlement emails:', error);
    throw error;
  }
};

module.exports = {
  sendSettlementEmail
}; 