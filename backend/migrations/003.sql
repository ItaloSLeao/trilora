ALTER TABLE workspace ADD COLUMN next_check timestamptz NOT NULL DEFAULT now();
CREATE INDEX workspace_due ON workspace(next_check);
CREATE INDEX message_thread ON message(convo,id DESC);
CREATE INDEX document_owner ON document(owner,subject);
CREATE INDEX event_owner_time ON event(owner,occurred DESC);
