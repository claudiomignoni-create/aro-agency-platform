"use client";

import { useState } from "react";
import type { ClientChannel, ClientChannelType } from "@/types/database";

type ChannelRow = {
  channel?: ClientChannel;
  id: string;
};

type ChannelFieldsProps = {
  initialChannels?: ClientChannel[];
};

const channelOptions: Array<{ label: string; value: ClientChannelType }> = [
  { label: "Instagram", value: "instagram" },
  { label: "Personal Instagram", value: "personal_instagram" },
  { label: "TikTok", value: "tiktok" },
  { label: "WeChat", value: "wechat" },
  { label: "RedNote / Xiaohongshu", value: "rednote" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Facebook", value: "facebook" },
  { label: "Telegram", value: "telegram" },
  { label: "Line", value: "line" },
  { label: "KakaoTalk", value: "kakao_talk" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Website", value: "website" },
  { label: "Email", value: "email" },
  { label: "Phone", value: "phone" },
  { label: "Other", value: "other" }
];

export function ChannelFields({ initialChannels = [] }: ChannelFieldsProps) {
  const initialRows = initialChannels.length
    ? initialChannels.map((channel) => ({ channel, id: channel.id }))
    : [{ id: "channel-new-1" }];
  const initialPrimary = initialChannels.find((channel) => channel.is_primary)?.id;
  const [channels, setChannels] = useState<ChannelRow[]>(initialRows);
  const [primaryId, setPrimaryId] = useState<string | null>(initialPrimary ?? null);
  const [nextId, setNextId] = useState(initialRows.length + 1);

  const addChannel = () => {
    setChannels((current) => [...current, { id: `channel-new-${nextId}` }]);
    setNextId((current) => current + 1);
  };

  const removeChannel = (id: string) => {
    setChannels((current) => current.filter((channel) => channel.id !== id));
    setPrimaryId((current) => (current === id ? null : current));
  };

  return (
    <section className="client-form-section">
      <div className="client-section-heading">
        <div>
          <span className="eyebrow">Canais da empresa</span>
          <h3>Canais e redes sociais</h3>
          <p>
            Salve redes sociais e canais extras da empresa, separados dos
            contatos das pessoas vinculadas.
          </p>
        </div>
        <button className="button secondary" onClick={addChannel} type="button">
          Adicionar canal
        </button>
      </div>

      <input name="channels_count" type="hidden" value={channels.length} />
      <input
        name="original_channel_ids"
        type="hidden"
        value={initialChannels.map((channel) => channel.id).join(",")}
      />

      {channels.length ? (
        <div className="contact-list">
          {channels.map((channel, index) => (
            <article className="contact-card" key={channel.id}>
              <div className="contact-card-header">
                <strong>Canal {index + 1}</strong>
                <button
                  className="button secondary"
                  onClick={() => removeChannel(channel.id)}
                  type="button"
                >
                  Remover
                </button>
              </div>
              <div className="client-form-grid">
                {channel.channel ? (
                  <input
                    name={`channels[${index}].id`}
                    type="hidden"
                    value={channel.channel.id}
                  />
                ) : null}
                <label>
                  Tipo de canal
                  <select
                    defaultValue={channel.channel?.channel_type ?? "instagram"}
                    name={`channels[${index}].channel_type`}
                  >
                    {channelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Valor
                  <input
                    defaultValue={channel.channel?.value ?? ""}
                    name={`channels[${index}].value`}
                    placeholder="@elitebangkok"
                  />
                </label>
                <label>
                  URL
                  <input
                    autoComplete="url"
                    defaultValue={channel.channel?.url ?? ""}
                    name={`channels[${index}].url`}
                    placeholder="https://..."
                    type="url"
                  />
                </label>
                <label>
                  Label interno
                  <input
                    defaultValue={channel.channel?.label ?? ""}
                    name={`channels[${index}].label`}
                    placeholder="Instagram oficial"
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    checked={primaryId === channel.id}
                    name={`channels[${index}].is_primary`}
                    onChange={() =>
                      setPrimaryId((current) =>
                        current === channel.id ? null : channel.id
                      )
                    }
                    type="checkbox"
                  />
                  Canal principal da empresa
                </label>
                <label className="wide-field">
                  Observações sobre o canal
                  <textarea
                    defaultValue={channel.channel?.notes ?? ""}
                    name={`channels[${index}].notes`}
                    rows={3}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Nenhum canal adicionado. O cliente ainda pode ser salvo sem canais
          extras.
        </p>
      )}
    </section>
  );
}
