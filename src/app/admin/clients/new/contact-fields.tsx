"use client";

import { useState } from "react";

type ContactRow = {
  id: number;
};

export function ContactFields() {
  const [contacts, setContacts] = useState<ContactRow[]>([{ id: 1 }]);
  const [primaryId, setPrimaryId] = useState<number | null>(1);
  const [nextId, setNextId] = useState(2);

  const addContact = () => {
    setContacts((current) => [...current, { id: nextId }]);
    setNextId((current) => current + 1);
  };

  const removeContact = (id: number) => {
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
                <label>
                  Nome da pessoa
                  <input
                    autoComplete="name"
                    name={`contacts[${index}].contact_name`}
                    placeholder="Anna"
                  />
                </label>
                <label>
                  Cargo ou função
                  <input name={`contacts[${index}].role`} placeholder="Booker" />
                </label>
                <label>
                  Email
                  <input
                    autoComplete="email"
                    name={`contacts[${index}].email`}
                    placeholder="anna@elitebangkok.com"
                    type="email"
                  />
                </label>
                <label>
                  Telefone
                  <input
                    autoComplete="tel"
                    name={`contacts[${index}].phone`}
                    placeholder="+66..."
                  />
                </label>
                <label>
                  WhatsApp
                  <input name={`contacts[${index}].whatsapp`} placeholder="+66..." />
                </label>
                <label>
                  WeChat
                  <input
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
                    name={`contacts[${index}].can_receive_emails`}
                    type="checkbox"
                  />
                  Pode receber emails futuramente
                </label>
                <label className="wide-field">
                  Observações sobre a pessoa
                  <textarea name={`contacts[${index}].notes`} rows={3} />
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
