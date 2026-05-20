import { ImapFlow } from 'imapflow';

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: 'andar@twibbonize.com',
    pass: 'hacktdxiedudwytl',
  },
  logger: false,
});

async function fetchFolderMessages(folderName, fetchCount = 5, label = '') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Folder: ${label || folderName}`);
  console.log('='.repeat(60));

  let mailbox;
  try {
    mailbox = await client.mailboxOpen(folderName);
  } catch (err) {
    console.log(`Could not open folder "${folderName}": ${err.message}`);
    return [];
  }

  const total = mailbox.exists;
  console.log(`Total messages in folder: ${total}`);

  if (total === 0) {
    console.log('No messages found.');
    return [];
  }

  // Fetch last N messages
  const start = Math.max(1, total - fetchCount + 1);
  const range = `${start}:${total}`;

  const results = [];

  for await (const msg of client.fetch(range, {
    uid: true,
    flags: true,
    envelope: true,
    bodyStructure: true,
    internalDate: true,
    headers: ['subject', 'from', 'to', 'date', 'content-type',
               'x-original-to', 'received', 'disposition-notification-to',
               'return-receipt-to', 'x-confirm-reading-to',
               'read-receipt-to', 'message-id', 'x-mailer',
               'x-google-dkim-signature', 'x-forwarded-to'],
  })) {
    const envelope = msg.envelope || {};
    const flags = [...(msg.flags || [])];
    const subject = envelope.subject || '(no subject)';
    const from = envelope.from?.map(a => `${a.name || ''} <${a.address}>`).join(', ') || '(unknown)';
    const to = envelope.to?.map(a => `${a.name || ''} <${a.address}>`).join(', ') || '(unknown)';
    const date = msg.internalDate?.toISOString() || '(unknown)';

    const entry = { uid: msg.uid, subject, from, to, date, flags, bodyStructure: msg.bodyStructure };
    results.push(entry);

    console.log(`\n--- Message UID ${msg.uid} ---`);
    console.log(`  Subject : ${subject}`);
    console.log(`  From    : ${from}`);
    console.log(`  To      : ${to}`);
    console.log(`  Date    : ${date}`);
    console.log(`  Flags   : ${flags.length ? flags.join(', ') : '(none)'}`);

    // Check for read receipt / MDN indicators in subject or from
    const subjectLower = subject.toLowerCase();
    const fromLower = from.toLowerCase();
    const isReadReceipt = subjectLower.includes('read:') ||
                          subjectLower.includes('read receipt') ||
                          subjectLower.includes('message read') ||
                          subjectLower.includes('delivery receipt') ||
                          subjectLower.includes('disposition notification');
    const isDeliveryStatus = subjectLower.includes('delivery status') ||
                             subjectLower.includes('undelivered mail') ||
                             subjectLower.includes('mail delivery') ||
                             subjectLower.includes('failed delivery') ||
                             subjectLower.includes('delivery failure') ||
                             subjectLower.includes('mailer-daemon') ||
                             fromLower.includes('mailer-daemon') ||
                             fromLower.includes('postmaster');

    if (isReadReceipt) console.log(`  *** READ RECEIPT DETECTED ***`);
    if (isDeliveryStatus) console.log(`  *** DELIVERY STATUS NOTIFICATION ***`);

    // Print body structure content-types
    if (msg.bodyStructure) {
      const types = collectContentTypes(msg.bodyStructure);
      if (types.length) {
        console.log(`  Content-Types in body: ${types.join(', ')}`);
        // Check for MDN content type
        if (types.some(t => t.includes('disposition-notification'))) {
          console.log(`  *** MDN (Read Receipt) CONTENT TYPE FOUND ***`);
        }
        if (types.some(t => t.includes('delivery-status'))) {
          console.log(`  *** DELIVERY STATUS CONTENT TYPE FOUND ***`);
        }
      }
    }
  }

  return results;
}

function collectContentTypes(structure) {
  const types = [];
  if (!structure) return types;
  const ct = `${structure.type}/${structure.subtype}`.toLowerCase();
  types.push(ct);
  if (structure.childNodes) {
    for (const child of structure.childNodes) {
      types.push(...collectContentTypes(child));
    }
  }
  return types;
}

async function listFolders() {
  console.log('\n--- Available Folders / Mailboxes ---');
  const folderList = await client.list('', '*');
  const folders = folderList.map(f => f.path);
  folders.forEach(f => console.log(`  ${f}`));
  return folders;
}

async function main() {
  console.log('Connecting to Gmail IMAP...');
  await client.connect();
  console.log('Connected successfully.');

  // List all folders first
  const folders = await listFolders();

  // Check INBOX
  await fetchFolderMessages('INBOX', 10, 'INBOX (last 10)');

  // Determine sent folder name
  const sentFolder = folders.find(f =>
    f === '[Gmail]/Sent Mail' ||
    f === 'Sent' ||
    f === '[Gmail]/Sent' ||
    f.toLowerCase().includes('sent')
  );

  if (sentFolder) {
    await fetchFolderMessages(sentFolder, 10, `${sentFolder} (last 10 sent)`);
  } else {
    console.log('\nNo Sent folder found.');
  }

  // Check for Drafts with open tracking headers
  const draftsFolder = folders.find(f =>
    f === '[Gmail]/Drafts' || f.toLowerCase().includes('draft')
  );
  if (draftsFolder) {
    await fetchFolderMessages(draftsFolder, 5, `${draftsFolder} (last 5 drafts)`);
  }

  console.log('\n\n=== SUMMARY: Gmail Native Open Tracking ===');
  console.log('Gmail does NOT expose open tracking data via IMAP.');
  console.log('The \\Seen IMAP flag on SENT messages only means YOU have read/viewed that sent item,');
  console.log('not that the RECIPIENT opened it.');
  console.log('');
  console.log('For native read receipts (MDN), the recipient must have approved sending one.');
  console.log('Gmail web client does not send MDN receipts by default.');
  console.log('');
  console.log('To track opens you need: pixel tracking in HTML emails or a third-party service.');

  await client.logout();
  console.log('\nDisconnected from IMAP.');
}

main().catch(err => {
  console.error('Error:', err.message);
  client.close();
  process.exit(1);
});
