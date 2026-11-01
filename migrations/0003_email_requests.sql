ALTER TABLE requests ADD COLUMN source TEXT NOT NULL DEFAULT 'form' CHECK(source IN ('form','email'));
ALTER TABLE requests ADD COLUMN email_subject TEXT NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN email_message_key TEXT;
CREATE UNIQUE INDEX requests_email_message ON requests(email_message_key) WHERE email_message_key IS NOT NULL;
