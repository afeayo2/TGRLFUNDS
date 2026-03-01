function loanApprovedTemplate(name, amount) {
  return `
  <div style="font-family: Arial; padding: 20px; background:#f4f6f8;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;">
      <h2 style="color:#16a34a;">🎉 Loan Approved!</h2>
      <p>Dear <b>${name}</b>,</p>
      <p>We are pleased to inform you that your loan request has been approved.</p>

      <div style="background:#f0fdf4;padding:15px;border-radius:8px;margin:20px 0;">
        <h3>Approved Amount: ₦${amount.toLocaleString()}</h3>
      </div>

      <p>The funds have been disbursed to your TrustGolden account.</p>

      <p>Thank you for choosing us.</p>

      <hr/>
      <small>TrustGolden Team</small>
    </div>
  </div>
  `;
}

function loanRejectedTemplate(name) {
  return `
  <div style="font-family: Arial; padding: 20px; background:#f4f6f8;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;">
      <h2 style="color:#dc2626;">Loan Request Update</h2>
      <p>Dear <b>${name}</b>,</p>
      <p>We regret to inform you that your recent loan request was not approved at this time.</p>

      <p>You may reapply after reaching your saving eligibility.</p>

      <hr/>
      <small>TrustGolden  Team</small>
    </div>
  </div>
  `;
}

module.exports = {
  loanApprovedTemplate,
  loanRejectedTemplate
};