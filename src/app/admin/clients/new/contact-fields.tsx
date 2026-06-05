"use client";

import { useState } from "react";
import type { ClientContact } from "@/types/database";

type ContactRow = {
  id: string;
  contact?: ClientContact;
};

type ContactFieldsProps = {
  initialContacts?: ClientContact[];
};

export function ContactFields({ initialContacts = [] }: ContactFieldsProps) {
  const initialRows = initialContacts.length
    ? initialContacts.map((contact) => ({ contact, id: contact.id }))
    : [{ id: "new-1" }];
  const initialPrimary = initialContacts.find((contact) => contact.is_primary)?.id;
  const [contacts, setContacts] = useState<ContactRow[]>(initialRows);
  const [primaryId, setPrimaryId] = useState<string | null>(
    initialPrimary ?? (initialContacts.length ? null : initialRows[0]?.id ?? null)
  );
  const [nextId, setNextId] = useState(initialRows.length + 1);

  const addContact = () => {
    setContacts((current) => [...current, { id: `new-${nextId}` }]);
    setNextId((current) => current + 1);
  };

  const removeContact = (id: string) => {
    setContacts((current) => current.filter((contact) => contact.id !== id));
    setPrimaryId((current) => (current === id ? null : current));
  };

  return (
    <section className="client-form-section">
      <div className="client-section-heading">
        <div>
          <span className="eyebrow">Pessoas de contato</span>
          <h3>Contatos vinculados</h3>
          <p>
            Cadastre pessoas ligadas à empresa. Estes dados são separados dos
            contatos gerais institucionais.
          </p>
        </div>
        <button className="button secondary" onClick={addContact} type="button">
          Adicionar pessoa
        </button>
      </div>

      <input name="contacts_count" type="hidden" value={contacts.length} />
      <input
        name="original_contact_ids"
        type="hidden"
        value={initialContacts.map((contact) => contact.id).join(",")}
      />

      {contacts.length ? (
        <div className="contact-list">
          {contacts.map((contact, index) => (
            <article className="contact-card" key={contact.id}>
              <div className="contact-card-header">
                <strong>Pessoa {index + 1}</strong>
                <button
                  className="button secondary"
                  onClick={() => removeContact(contact.id)}
                  type="button"
                >
                  Remover
                </button>
              </div>
              <div className="client-form-grid">
                {contact.contact ? (
                  <input
                    name={`contacts[${index}].id`}
                    type="hidden"
                    value={contact.contact.id}
                  />
                ) : null}
                <label>
                  Nome da pessoa
                  <input
                    autoComplete="name"
                    defaultValue={contact.contact?.contact_name ?? ""}
                    name={`contacts[${index}].contact_name`}
                    placeholder="Anna"
                  />
                </label>
                <label>
                  Cargo ou função
                  <input
                    defaultValue={contact.contact?.role ?? ""}
                    name={`contacts[${index}].role`}
                    placeholder="Booker"
                  />
                </label>
                <label>
                  Email
                  <input
                    autoComplete="email"
                    defaultValue={contact.contact?.email ?? ""}
                    name={`contacts[${index}].email`}
                    placeholder="anna@elitebangkok.com"
                    type="email"
                  />
                </label>
                <label>
                  Telefone
                  <input
                    autoComplete="tel"
                    defaultValue={contact.contact?.phone ?? ""}
                    name={`contacts[${index}].phone`}
                    placeholder="+66..."
                  />
                </label>
                <label>
                  WhatsApp
                  <input
                    defaultValue={contact.contact?.whatsapp ?? ""}
                    name={`contacts[${index}].whatsapp`}
                    placeholder="+66..."
                  />
                </label>
                <label>
                  WeChat
                  <input
                    defaultValue={contact.contact?.wechat ?? ""}
                    name={`contacts[${index}].wechat`}
                    placeholder="WeChat da pessoa"
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    checked={primaryId === contact.id}
                    name={`contacts[${index}].is_primary`}
                    onChange={() =>
                      setPrimaryId((current) =>
                        current === contact.id ? null : contact.id
                      )
                    }
                    type="checkbox"
                  />
                  Contato principal
                </label>
                <label className="checkbox-field">
                  <input
                    defaultChecked={contact.contact?.can_receive_emails ?? false}
                    name={`contacts[${index}].can_receive_emails`}
                    type="checkbox"
                  />
                  Pode receber emails futuramente
                </label>
                <label className="wide-field">
                  Observações sobre a pessoa
                  <textarea
                    defaultValue={contact.contact?.notes ?? ""}
                    name={`contacts[${index}].notes`}
                    rows={3}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Nenhuma pessoa adicionada. O cliente ainda pode ser salvo sem contatos
          vinculados.
        </p>
      )}
    </section>
  );
}
