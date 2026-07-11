/*
 * Loop — Salesforce demo data (Anonymous Apex).
 *
 * HOW TO RUN:
 *   Developer Console → Debug → Open Execute Anonymous Window → paste this whole
 *   file → check "Open Log" → Execute. Then read the Log for lines starting with
 *   ">>> CASE" to get the auto-assigned Case Numbers to use in Slack.
 *   (Or:  sf apex run --file scripts/salesforce-demo-data.apex --target-org <alias>)
 *
 * Creates: 3 accounts, 5 prior closed cases, the flagship Acme SSO escalation
 * (with 3 case comments + an open task), a resolved Northwind case, and a Globex
 * billing case.
 */

// 1. Accounts (tier is in Description; Type is set too if the picklist allows it)
Account acme = new Account(Name = 'Acme Corp',
  Description = 'Enterprise tier customer. SSO via SAML (their IdP). ~200 seats.');
Account northwind = new Account(Name = 'Northwind Traders',
  Description = 'Enterprise tier customer. SSO via SAML.');
Account globex = new Account(Name = 'Globex',
  Description = 'Standard tier customer. Annual billing.');
insert new List<Account>{ acme, northwind, globex };

// Best-effort: set the Type picklist to the tier. Caught if the values aren't in
// the picklist — the demo still works because tier is in Description.
try {
  acme.Type = 'Enterprise';
  northwind.Type = 'Enterprise';
  globex.Type = 'Standard';
  update new List<Account>{ acme, northwind, globex };
} catch (Exception e) {
  System.debug('>>> Type not set (optional): add Enterprise/Standard to the Account Type picklist to enable. ' + e.getMessage());
}

// 2. Prior CLOSED cases — drive the "N prior case(s)" count in the brief
insert new List<Case>{
  new Case(AccountId = acme.Id,   Subject = 'Password reset emails delayed',   Status = 'Closed', Origin = 'Email'),
  new Case(AccountId = acme.Id,   Subject = 'API rate limit increase request', Status = 'Closed', Origin = 'Web'),
  new Case(AccountId = acme.Id,   Subject = 'Add SSO test user to sandbox',     Status = 'Closed', Origin = 'Email'),
  new Case(AccountId = acme.Id,   Subject = 'Billing contact update',           Status = 'Closed', Origin = 'Phone'),
  new Case(AccountId = globex.Id, Subject = 'Seat count question',              Status = 'Closed', Origin = 'Email')
};

// 3. Flagship case — Acme SSO escalation
Case acmeCase = new Case(
  AccountId   = acme.Id,
  Subject     = 'SSO login failing — "SAML assertion invalid" after signing-cert rotation',
  Status      = 'Escalated',
  Priority    = 'High',
  Origin      = 'Phone',
  Description = 'All ~200 Acme Enterprise users get "SAML assertion invalid" immediately after the IdP redirect, '
             + 'starting right after Acme rotated their SAML signing certificate overnight. Re-uploaded the new cert '
             + 'on our side; ACS URL and Entity ID unchanged; IdP metadata XML parses. Error still fires for every user.'
);
insert acmeCase;

// 3a. Case comments (the newest is what Loop surfaces as "Latest")
insert new List<CaseComment>{
  new CaseComment(ParentId = acmeCase.Id, IsPublished = true,
    CommentBody = 'Customer rotated their SAML signing cert last night; SSO broke at ~08:00. Re-uploaded the cert on our side and confirmed the ACS URL is unchanged.'),
  new CaseComment(ParentId = acmeCase.Id, IsPublished = true,
    CommentBody = 'Escalated — all ~200 Enterprise users locked out. Paged the escalation owner.'),
  new CaseComment(ParentId = acmeCase.Id, IsPublished = true,
    CommentBody = 'Customer replied 1h ago: the error still persists after the cert rotation. Next step is to have them re-publish their IdP metadata. Awaiting confirmation.')
};

// 3b. Open follow-up task on the case
insert new Task(
  WhatId       = acmeCase.Id,
  Subject      = 'Follow up: have Acme re-publish IdP metadata, then clear our cached cert',
  ActivityDate = Date.today(),
  Status       = 'Not Started',
  Priority     = 'High'
);

// 4. Resolved Northwind case — same error, already fixed (parallel context)
Case nwCase = new Case(
  AccountId   = northwind.Id,
  Subject     = 'SSO login failing — "SAML assertion invalid" after signing-cert rotation',
  Status      = 'Closed',
  Priority    = 'High',
  Origin      = 'Email',
  Description = 'After Northwind rotated their SAML signing certificate, all SSO logins returned "SAML assertion invalid". Resolved.'
);
insert nwCase;
insert new List<CaseComment>{
  new CaseComment(ParentId = nwCase.Id, IsPublished = true,
    CommentBody = 'Root cause: the IdP-side signing certificate fingerprint was not updated after rotation, so our SP rejected the assertion.'),
  new CaseComment(ParentId = nwCase.Id, IsPublished = true,
    CommentBody = 'Fix: had Northwind re-publish their IdP metadata and cleared the cached signing cert in our SSO config. Logins restored in ~20 min.')
};

// 5. Globex billing case
Case globexCase = new Case(
  AccountId   = globex.Id,
  Subject     = 'Double charge on March annual-plan invoice — refund requested',
  Status      = 'Open',
  Priority    = 'Medium',
  Origin      = 'Email',
  Description = 'Globex March invoice charged the annual plan twice. Customer wants a refund confirmation today.'
);
insert globexCase;
insert new CaseComment(ParentId = globexCase.Id, IsPublished = true,
  CommentBody = 'Agent left an internal note yesterday; awaiting customer confirmation of the duplicate charge before issuing the refund.');

// 6. Print the assigned Case Numbers to use in Slack
System.debug('>>> ====== USE THESE CASE NUMBERS IN SLACK ======');
for (Case c : [SELECT CaseNumber, Subject, Account.Name FROM Case
               WHERE Id IN (:acmeCase.Id, :nwCase.Id, :globexCase.Id)]) {
  System.debug('>>> CASE ' + c.CaseNumber + '  |  ' + c.Account.Name + '  |  ' + c.Subject);
}
System.debug('>>> Acme = your flagship handoff. Globex = the billing demo.');
