"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  Model,
  ModelInternationalAgency,
  ModelOption,
  ModelOptionType,
  ModelProfile,
  ModelUpdateRequest
} from "@/types/database";
import { ModelMediaGallery } from "./model-media-gallery";
import {
  createModelOptionAction,
  createModelWorkHistoryAction,
  deleteModelWorkHistoryAction,
  markMeasurementsUpdatedAction,
  markMediaUpdatedAction,
  markProfileReviewedAction,
  sendModelUpdateRequestAction,
  updateModelBasicAction,
  updateModelContactAction,
  updateModelDocumentsAction,
  updateModelHealthLogisticsAction,
  updateModelInternalNotesAction,
  updateModelMeasurementsAction,
  updateModelRepresentationAction,
  updateModelSkillsAction,
  updateModelSocialLinksAction
} from "./actions";

type ModelFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  model?: Model;
  submitLabel: string;
};

export function ModelForm({ action, model, submitLabel }: ModelFormProps) {
  return (
    <form action={action} className="form wide-form">
      <div className="grid">
        <label>
          Nome artístico
          <input
            defaultValue={model?.display_name ?? ""}
            name="display_name"
            required
          />
        </label>
        <label>
          Nome civil
          <input defaultValue={model?.legal_name ?? ""} name="legal_name" />
        </label>
        <label>
          E-mail
          <input defaultValue={model?.email ?? ""} name="email" type="email" />
        </label>
        <label>
          Telefone
          <input defaultValue={model?.phone ?? ""} name="phone" />
        </label>
        <label>
          Status
          <select defaultValue={model?.status ?? "draft"} name="status">
            <option value="draft">draft</option>
            <option value="pending_review">pending_review</option>
            <option value="approved">approved</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label>
          Gênero
          <input defaultValue={model?.gender ?? ""} name="gender" />
        </label>
        <label>
          Nacionalidade
          <input defaultValue={model?.nationality ?? ""} name="nationality" />
        </label>
        <label>
          Localização
          <input defaultValue={model?.location ?? ""} name="location" />
        </label>
        <label>
          Data de nascimento
          <input
            defaultValue={model?.birth_date ?? ""}
            name="birth_date"
            type="date"
          />
        </label>
      </div>

      <label>
        Bio
        <textarea defaultValue={model?.bio ?? ""} name="bio" />
      </label>

      <div className="grid">
        <label>
          Altura em cm
          <input
            defaultValue={model?.height_cm ?? ""}
            name="height_cm"
            type="number"
          />
        </label>
        <label>
          Busto
          <input
            defaultValue={model?.bust_cm ?? ""}
            name="bust_cm"
            type="number"
          />
        </label>
        <label>
          Cintura
          <input
            defaultValue={model?.waist_cm ?? ""}
            name="waist_cm"
            type="number"
          />
        </label>
        <label>
          Quadril
          <input
            defaultValue={model?.hips_cm ?? ""}
            name="hips_cm"
            type="number"
          />
        </label>
        <label>
          Sapato
          <input defaultValue={model?.shoe_size ?? ""} name="shoe_size" />
        </label>
        <label>
          Roupa
          <input
            defaultValue={model?.clothing_size ?? ""}
            name="clothing_size"
          />
        </label>
        <label>
          Cabelo
          <input defaultValue={model?.hair_color ?? ""} name="hair_color" />
        </label>
        <label>
          Olhos
          <input defaultValue={model?.eye_color ?? ""} name="eye_color" />
        </label>
      </div>

      <div className="grid">
        <label>
          Categorias
          <input
            defaultValue={model?.categories.join(", ") ?? ""}
            name="categories"
            placeholder="fashion, beauty, runway"
          />
        </label>
        <label>
          Tags
          <input
            defaultValue={model?.tags.join(", ") ?? ""}
            name="tags"
            placeholder="editorial, comercial"
          />
        </label>
      </div>

      <label>
        Notas internas
        <textarea defaultValue={model?.notes ?? ""} name="notes" />
      </label>

      <div className="checkbox-row">
        <label>
          <input
            defaultChecked={model?.is_published ?? false}
            name="is_published"
            type="checkbox"
          />
          Publicado quando aprovado
        </label>
        <label>
          <input
            defaultChecked={model?.consent_lgpd ?? false}
            name="consent_lgpd"
            type="checkbox"
          />
          Consentimento LGPD registrado
        </label>
      </div>

      <div className="actions">
        <SaveButton>{submitLabel}</SaveButton>
        <Link className="button secondary" href="/admin/models">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export const modelProfileTabs = [
  { id: "basic", label: "Informações" },
  { id: "documents", label: "Documentos" },
  { id: "media", label: "Mídia" },
  { id: "skills", label: "Habilidades" },
  { id: "work", label: "Trabalhos importantes" },
  { id: "health", label: "Saúde e logística" },
  { id: "representation", label: "Representação e carreira" },
  { id: "internal", label: "Observações internas" },
  { id: "history", label: "Histórico e atualizações" }
] as const;

export type ModelProfileTab = (typeof modelProfileTabs)[number]["id"];

export function isModelProfileTab(tab: string): tab is ModelProfileTab {
  return modelProfileTabs.some((item) => item.id === tab);
}

type ModelProfileEditorProps = {
  activeTab: ModelProfileTab;
  profile: ModelProfile;
};

type FieldProps = {
  label: string;
  name: string;
  value?: string | number | null;
  required?: boolean;
  type?: string;
};

function Field({
  label,
  name,
  required = false,
  type = "text",
  value
}: FieldProps) {
  return (
    <label>
      {label}
      <input
        defaultValue={value ?? ""}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function TextareaField({ label, name, value }: FieldProps) {
  return (
    <label>
      {label}
      <textarea defaultValue={value ?? ""} name={name} />
    </label>
  );
}

function CheckboxField({
  checked: defaultChecked,
  label,
  name
}: {
  checked?: boolean;
  label: string;
  name: string;
}) {
  return (
    <label>
      <input defaultChecked={defaultChecked ?? false} name={name} type="checkbox" />
      {label}
    </label>
  );
}

function SaveButton({ children = "Salvar" }: { children?: string }) {
  return (
    <button className="button" type="submit">
      {children}
    </button>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function historyDateValue(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

function requestStatusLabel(status: string | null | undefined) {
  const normalized = status?.toLowerCase();

  if (!normalized || normalized === "sent" || normalized === "pending") {
    return "Pendente";
  }

  if (normalized === "completed" || normalized === "reviewed") {
    return "Revisado";
  }

  if (normalized === "approved") {
    return "Aprovado";
  }

  if (normalized === "rejected") {
    return "Rejeitado";
  }

  return status ?? "Pendente";
}

function requestStatusTone(status: string | null | undefined) {
  const normalized = status?.toLowerCase();

  if (normalized === "approved" || normalized === "completed" || normalized === "reviewed") {
    return "positive";
  }

  if (normalized === "rejected") {
    return "negative";
  }

  return "pending";
}

type HistoryEntry = {
  actor: string;
  date: string | null;
  id: string;
  origin: string;
  sections?: string[];
  status: string;
  statusTone: string;
  summary: string;
  title: string;
};

function updateRequestHistoryEntry(request: ModelUpdateRequest): HistoryEntry {
  const isCompleted = Boolean(request.completed_at);

  return {
    actor: isCompleted
      ? request.email_to ?? "Modelo"
      : request.requested_by
        ? "Admin"
        : request.email_to ?? "Origem não identificada",
    date: request.completed_at ?? request.sent_at,
    id: `request-${request.id}`,
    origin: isCompleted
      ? "Modelo"
      : request.requested_by
        ? "Admin"
        : request.email_to
          ? "Modelo"
          : "Origem não identificada",
    sections: request.requested_sections,
    status: requestStatusLabel(request.status),
    statusTone: requestStatusTone(request.status),
    summary: request.message ?? "Pedido de atualização do Cadastro360.",
    title: isCompleted ? "Atualização recebida" : "Pedido de atualização"
  };
}

function modelTimestampHistoryEntries(model: Model, hasUpdateRequests: boolean) {
  const entries: HistoryEntry[] = [
    {
      actor: "Equipe AROLAB",
      date: model.last_profile_update_at,
      id: "last-profile-update",
      origin: "Agência",
      sections: ["Perfil"],
      status: "Atualizado",
      statusTone: "positive",
      summary: "Dados principais do Cadastro360 foram atualizados.",
      title: "Perfil atualizado"
    },
    {
      actor: "Equipe AROLAB",
      date: model.last_measurements_update_at,
      id: "last-measurements-update",
      origin: "Agência",
      sections: ["Medidas"],
      status: "Atualizado",
      statusTone: "positive",
      summary: "Medidas e características físicas foram atualizadas.",
      title: "Medidas atualizadas"
    },
    {
      actor: "Equipe AROLAB",
      date: model.last_media_update_at,
      id: "last-media-update",
      origin: "Agência",
      sections: ["Mídia"],
      status: "Atualizado",
      statusTone: "positive",
      summary: "Materiais de mídia foram atualizados.",
      title: "Mídia atualizada"
    },
    {
      actor: "Equipe AROLAB",
      date: model.profile_reviewed_at,
      id: "profile-reviewed",
      origin: "Admin",
      sections: ["Cadastro360"],
      status: "Revisado",
      statusTone: "positive",
      summary: "Perfil marcado como revisado pela equipe.",
      title: "Perfil revisado"
    }
  ];

  if (!hasUpdateRequests) {
    entries.push({
      actor: "Admin",
      date: model.last_update_request_sent_at,
      id: "last-update-request",
      origin: "Admin",
      sections: ["Perfil", "Medidas", "Mídia"],
      status: "Pendente",
      statusTone: "pending",
      summary: "Pedido administrativo de atualização enviado ao modelo.",
      title: "Pedido enviado"
    });
  }

  return entries.filter((entry) => entry.date);
}

function modelHistoryEntries(model: Model, updateRequests: ModelUpdateRequest[]) {
  return [
    ...updateRequests.map(updateRequestHistoryEntry),
    ...modelTimestampHistoryEntries(model, updateRequests.length > 0)
  ].sort((first, second) => historyDateValue(second.date) - historyDateValue(first.date));
}

function listValue(values: string[] | null | undefined) {
  return values?.length ? values.join(", ") : "";
}

const officialModelCategories = [
  "Desenvolvimento",
  "New Face",
  "Mainboard",
  "Image"
];

type SelectableModelOption = Pick<ModelOption, "id" | "label">;

const modelOptionConfig: Record<
  ModelOptionType,
  {
    addLabel: string;
    emptyLabel: string;
    fieldName: string;
    placeholder: string;
    title: string;
  }
> = {
  hobby: {
    addLabel: "Adicionar hobby",
    emptyLabel: "Nenhum hobby cadastrado.",
    fieldName: "hobby_options",
    placeholder: "Ex: Fotografia",
    title: "Lifestyle e publicidade"
  },
  instrument: {
    addLabel: "Adicionar instrumento",
    emptyLabel: "Nenhum instrumento cadastrado.",
    fieldName: "instruments",
    placeholder: "Ex: Harpa",
    title: "Instrumentos"
  },
  language: {
    addLabel: "Adicionar idioma",
    emptyLabel: "Nenhum idioma cadastrado.",
    fieldName: "languages",
    placeholder: "Ex: Holandês",
    title: "Idiomas"
  },
  skill: {
    addLabel: "Adicionar habilidade",
    emptyLabel: "Nenhuma habilidade cadastrada.",
    fieldName: "skill_options",
    placeholder: "Ex: Teleprompter",
    title: "Performance e cena"
  },
  sport: {
    addLabel: "Adicionar esporte",
    emptyLabel: "Nenhum esporte cadastrado.",
    fieldName: "sport_options",
    placeholder: "Ex: Remo",
    title: "Esportes e atividades físicas"
  }
};

const languageLevelOptions = [
  "",
  "Básico",
  "Intermediário",
  "Avançado",
  "Fluente",
  "Nativo"
];

function optionsForType(options: ModelOption[], optionType: ModelOptionType) {
  return options.filter((option) => option.option_type === optionType);
}

function optionsWithSelected(
  options: ModelOption[],
  selectedValues: string[] | null | undefined
): SelectableModelOption[] {
  const selected = selectedValues ?? [];
  const existing = new Set(options.map((option) => option.label));
  const selectedOnly = selected
    .filter((label) => label && !existing.has(label))
    .map((label) => ({
      id: `selected-${label}`,
      label
    }));

  return [...options, ...selectedOnly];
}

function OptionChecklist({
  emptyLabel,
  name,
  options,
  selectedValues
}: {
  emptyLabel: string;
  name: string;
  options: SelectableModelOption[];
  selectedValues?: string[] | null;
}) {
  const selected = new Set(selectedValues ?? []);

  if (options.length === 0) {
    return <p className="notice">{emptyLabel}</p>;
  }

  return (
    <div className="option-chip-grid">
      {options.map((option) => (
        <label
          className={`option-chip${selected.has(option.label) ? " is-selected" : ""}`}
          key={option.id}
        >
          <input
            defaultChecked={selected.has(option.label)}
            name={name}
            type="checkbox"
            value={option.label}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function CategoryChecklist({ selectedValues }: { selectedValues?: string[] | null }) {
  const selected = new Set(selectedValues ?? []);
  const legacyCategories = (selectedValues ?? []).filter(
    (category) => !officialModelCategories.includes(category)
  );

  return (
    <div className="category-chip-field">
      {legacyCategories.map((category) => (
        <input key={category} name="categories" type="hidden" value={category} />
      ))}
      <div className="option-chip-grid">
        {officialModelCategories.map((category) => (
          <label
            className={`option-chip${selected.has(category) ? " is-selected" : ""}`}
            key={category}
          >
            <input
              defaultChecked={selected.has(category)}
              name="categories"
              type="checkbox"
              value={category}
            />
            <span>{category}</span>
          </label>
        ))}
      </div>
      {legacyCategories.length ? (
        <p className="notice">
          Categorias antigas preservadas: {legacyCategories.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

function LanguageChecklist({
  emptyLabel,
  levels,
  options,
  selectedValues
}: {
  emptyLabel: string;
  levels?: Record<string, string> | null;
  options: SelectableModelOption[];
  selectedValues?: string[] | null;
}) {
  const selected = new Set(selectedValues ?? []);

  if (options.length === 0) {
    return <p className="notice">{emptyLabel}</p>;
  }

  return (
    <div className="language-option-list">
      {options.map((option) => (
        <div className="language-option-row" key={option.id}>
          <label
            className={`option-chip${selected.has(option.label) ? " is-selected" : ""}`}
          >
            <input
              defaultChecked={selected.has(option.label)}
              name="languages"
              type="checkbox"
              value={option.label}
            />
            <span>{option.label}</span>
          </label>
          <select
            defaultValue={levels?.[option.label] ?? ""}
            name={`language_level:${option.label}`}
          >
            {languageLevelOptions.map((level) => (
              <option key={level || "empty"} value={level}>
                {level || "Nível"}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function AddModelOptionForm({
  modelId,
  optionType
}: {
  modelId: string;
  optionType: ModelOptionType;
}) {
  const config = modelOptionConfig[optionType];

  return (
    <form
      action={createModelOptionAction.bind(null, modelId)}
      className="option-add-form"
    >
      <input name="option_type" type="hidden" value={optionType} />
      <label>
        <span>{config.addLabel}</span>
        <input
          maxLength={80}
          name="label"
          placeholder={config.placeholder}
          required
        />
      </label>
      <button className="button secondary" type="submit">
        Adicionar
      </button>
    </form>
  );
}

function BasicTab({ profile }: { profile: ModelProfile }) {
  const { model, socialLinks } = profile;

  return (
    <form
      action={updateModelBasicAction.bind(null, model.id)}
      className="form wide-form consolidated-basic-form"
    >
      <section className="profile-form-section">
        <h3>Dados principais</h3>
        <div className="grid">
          <Field
            label="Nome artístico"
            name="stage_name"
            required
            value={model.stage_name ?? model.display_name}
          />
          <Field label="Nome civil" name="legal_name" value={model.legal_name} />
          <Field label="Gênero" name="gender" value={model.gender} />
          <Field label="Pronomes" name="pronouns" value={model.pronouns} />
          <Field
            label="Data de nascimento"
            name="birth_date"
            type="date"
            value={model.birth_date}
          />
          <Field label="Nacionalidade" name="nationality" value={model.nationality} />
          <Field label="Cidade atual" name="current_city" value={model.current_city} />
          <Field
            label="País atual"
            name="current_country"
            value={model.current_country}
          />
          <Field label="Cidade base" name="base_city" value={model.base_city} />
          <Field label="País base" name="base_country" value={model.base_country} />
          <Field label="Localização comercial" name="location" value={model.location} />
          <Field label="Tipo de modelo" name="model_type" value={model.model_type} />
          <label>
            Status
            <select defaultValue={model.status} name="status">
              <option value="draft">draft</option>
              <option value="pending_review">pending_review</option>
              <option value="approved">approved</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>
        <div className="stack compact-stack">
          <span className="field-label">Categorias</span>
          <CategoryChecklist selectedValues={model.categories} />
        </div>
        <TextareaField label="Bio comercial" name="bio" value={model.bio} />
        <div className="checkbox-row">
          <CheckboxField checked={model.is_minor} label="Modelo menor de idade" name="is_minor" />
          <CheckboxField
            checked={model.is_published}
            label="Publicado para clientes quando aprovado"
            name="is_published"
          />
        </div>
      </section>

      <section className="profile-form-section">
        <h3>Medidas</h3>
        <div className="grid">
          <Field label="Altura em cm" name="height_cm" type="number" value={model.height_cm} />
          <Field label="Busto" name="bust_cm" type="number" value={model.bust_cm} />
          <Field label="Cintura" name="waist_cm" type="number" value={model.waist_cm} />
          <Field label="Quadril" name="hips_cm" type="number" value={model.hips_cm} />
          <Field label="Sapato BR" name="shoe_size_br" value={model.shoe_size_br ?? model.shoe_size} />
          <Field label="Sapato EU" name="shoe_size_eu" value={model.shoe_size_eu} />
          <Field label="Sapato US" name="shoe_size_us" value={model.shoe_size_us} />
          <Field label="Vestido BR" name="dress_size_br" value={model.dress_size_br ?? model.clothing_size} />
          <Field label="Vestido EU" name="dress_size_eu" value={model.dress_size_eu} />
          <Field label="Vestido US" name="dress_size_us" value={model.dress_size_us} />
          <Field label="Camisa" name="shirt_size" value={model.shirt_size} />
          <Field label="Calça" name="pants_size" value={model.pants_size} />
          <Field label="Terno" name="suit_size" value={model.suit_size} />
          <Field label="Cor do cabelo" name="hair_color" value={model.hair_color} />
          <Field label="Comprimento do cabelo" name="hair_length" value={model.hair_length} />
          <Field label="Tipo de cabelo" name="hair_type" value={model.hair_type} />
          <Field label="Cor dos olhos" name="eye_color" value={model.eye_color} />
          <Field label="Tom de pele" name="skin_tone" value={model.skin_tone} />
        </div>
        <div className="grid">
          <TextareaField label="Tatuagens" name="tattoos" value={model.tattoos} />
          <TextareaField label="Piercings" name="piercings" value={model.piercings} />
          <TextareaField label="Cicatrizes visíveis" name="visible_scars" value={model.visible_scars} />
          <TextareaField label="Aparelho ortodôntico" name="braces" value={model.braces} />
        </div>
      </section>

      <section className="profile-form-section">
        <h3>Contato e endereço</h3>
        <div className="grid">
          <Field label="E-mail" name="email" type="email" value={model.email} />
          <Field label="Telefone" name="phone" value={model.phone} />
          <Field label="WhatsApp" name="whatsapp" value={model.whatsapp} />
          <Field label="WeChat" name="wechat" value={model.wechat} />
          <Field
            label="Contato de emergência"
            name="emergency_contact_name"
            value={model.emergency_contact_name}
          />
          <Field
            label="Telefone de emergência"
            name="emergency_contact_phone"
            value={model.emergency_contact_phone}
          />
          <Field
            label="Relação do contato"
            name="emergency_contact_relationship"
            value={model.emergency_contact_relationship}
          />
          <Field label="Endereço" name="address_line" value={model.address_line} />
          <Field label="Cidade" name="city" value={model.city} />
          <Field label="Estado" name="state" value={model.state} />
          <Field label="País" name="country" value={model.country} />
          <Field label="CEP / Postal code" name="postal_code" value={model.postal_code} />
        </div>
      </section>

      <section className="profile-form-section">
        <h3>Redes sociais</h3>
        <div className="grid">
          <Field label="Instagram" name="instagram" value={socialLinks?.instagram} />
          <Field label="TikTok" name="tiktok" value={socialLinks?.tiktok} />
          <Field label="YouTube" name="youtube" value={socialLinks?.youtube} />
          <Field label="Xiaohongshu" name="xiaohongshu" value={socialLinks?.xiaohongshu} />
          <Field label="Weibo" name="weibo" value={socialLinks?.weibo} />
          <Field label="WeChat ID" name="wechat_id" value={socialLinks?.wechat_id} />
          <Field label="Website" name="website" value={socialLinks?.website} />
          <Field
            label="Portfolio externo"
            name="external_portfolio_url"
            value={socialLinks?.external_portfolio_url}
          />
          <Field label="Composite URL" name="composite_url" value={socialLinks?.composite_url} />
        </div>
      </section>

      <SaveButton>Salvar informações</SaveButton>
    </form>
  );
}

function MeasurementsTab({ model }: { model: Model }) {
  return (
    <form
      action={updateModelMeasurementsAction.bind(null, model.id)}
      className="form wide-form"
    >
      <div className="grid">
        <Field label="Altura em cm" name="height_cm" type="number" value={model.height_cm} />
        <Field label="Busto" name="bust_cm" type="number" value={model.bust_cm} />
        <Field label="Cintura" name="waist_cm" type="number" value={model.waist_cm} />
        <Field label="Quadril" name="hips_cm" type="number" value={model.hips_cm} />
        <Field label="Sapato BR" name="shoe_size_br" value={model.shoe_size_br ?? model.shoe_size} />
        <Field label="Sapato EU" name="shoe_size_eu" value={model.shoe_size_eu} />
        <Field label="Sapato US" name="shoe_size_us" value={model.shoe_size_us} />
        <Field label="Vestido BR" name="dress_size_br" value={model.dress_size_br ?? model.clothing_size} />
        <Field label="Vestido EU" name="dress_size_eu" value={model.dress_size_eu} />
        <Field label="Vestido US" name="dress_size_us" value={model.dress_size_us} />
        <Field label="Camisa" name="shirt_size" value={model.shirt_size} />
        <Field label="Calça" name="pants_size" value={model.pants_size} />
        <Field label="Terno" name="suit_size" value={model.suit_size} />
        <Field label="Cor do cabelo" name="hair_color" value={model.hair_color} />
        <Field label="Comprimento do cabelo" name="hair_length" value={model.hair_length} />
        <Field label="Tipo de cabelo" name="hair_type" value={model.hair_type} />
        <Field label="Cor dos olhos" name="eye_color" value={model.eye_color} />
        <Field label="Tom de pele" name="skin_tone" value={model.skin_tone} />
      </div>
      <div className="grid">
        <TextareaField label="Tatuagens" name="tattoos" value={model.tattoos} />
        <TextareaField label="Piercings" name="piercings" value={model.piercings} />
        <TextareaField label="Cicatrizes visíveis" name="visible_scars" value={model.visible_scars} />
        <TextareaField label="Aparelho ortodôntico" name="braces" value={model.braces} />
      </div>
      <SaveButton>Salvar medidas</SaveButton>
    </form>
  );
}

function ContactTab({ model }: { model: Model }) {
  return (
    <form action={updateModelContactAction.bind(null, model.id)} className="form wide-form">
      <div className="grid">
        <Field label="E-mail" name="email" type="email" value={model.email} />
        <Field label="Telefone" name="phone" value={model.phone} />
        <Field label="WhatsApp" name="whatsapp" value={model.whatsapp} />
        <Field label="WeChat" name="wechat" value={model.wechat} />
        <Field
          label="Contato de emergência"
          name="emergency_contact_name"
          value={model.emergency_contact_name}
        />
        <Field
          label="Telefone de emergência"
          name="emergency_contact_phone"
          value={model.emergency_contact_phone}
        />
        <Field
          label="Relação do contato"
          name="emergency_contact_relationship"
          value={model.emergency_contact_relationship}
        />
      </div>
      <div className="grid">
        <Field label="Endereço" name="address_line" value={model.address_line} />
        <Field label="Cidade" name="city" value={model.city} />
        <Field label="Estado" name="state" value={model.state} />
        <Field label="País" name="country" value={model.country} />
        <Field label="CEP / Postal code" name="postal_code" value={model.postal_code} />
      </div>
      <SaveButton>Salvar contato</SaveButton>
    </form>
  );
}

function SocialTab({ profile }: { profile: ModelProfile }) {
  const { model, socialLinks } = profile;

  return (
    <form
      action={updateModelSocialLinksAction.bind(null, model.id)}
      className="form wide-form"
    >
      <div className="grid">
        <Field label="Instagram" name="instagram" value={socialLinks?.instagram} />
        <Field label="TikTok" name="tiktok" value={socialLinks?.tiktok} />
        <Field label="YouTube" name="youtube" value={socialLinks?.youtube} />
        <Field label="Xiaohongshu" name="xiaohongshu" value={socialLinks?.xiaohongshu} />
        <Field label="Weibo" name="weibo" value={socialLinks?.weibo} />
        <Field label="WeChat ID" name="wechat_id" value={socialLinks?.wechat_id} />
        <Field label="Website" name="website" value={socialLinks?.website} />
        <Field
          label="Portfolio externo"
          name="external_portfolio_url"
          value={socialLinks?.external_portfolio_url}
        />
        <Field label="Composite URL" name="composite_url" value={socialLinks?.composite_url} />
      </div>
      <SaveButton>Salvar redes sociais</SaveButton>
    </form>
  );
}

function DocumentsTab({ profile }: { profile: ModelProfile }) {
  const { documents, model } = profile;

  return (
    <form
      action={updateModelDocumentsAction.bind(null, model.id)}
      className="form wide-form"
    >
      <p className="notice">Documentos, endereço, saúde, dados bancários e notas internas ficam restritos ao admin.</p>
      <div className="grid">
        <Field label="CPF" name="cpf" value={documents?.cpf} />
        <Field label="RG" name="rg" value={documents?.rg} />
        <Field label="Passaporte" name="passport_number" value={documents?.passport_number} />
        <Field
          label="Validade do passaporte"
          name="passport_expiration"
          type="date"
          value={documents?.passport_expiration}
        />
        <Field label="Visto EUA" name="visa_us" value={documents?.visa_us} />
        <Field label="Visto UE" name="visa_eu" value={documents?.visa_eu} />
        <Field label="Visto China" name="visa_china" value={documents?.visa_china} />
        <Field label="Outros vistos" name="other_visas" value={documents?.other_visas} />
        <Field
          label="Responsável legal"
          name="legal_guardian_name"
          value={documents?.legal_guardian_name}
        />
        <Field
          label="Documento do responsável"
          name="legal_guardian_document"
          value={documents?.legal_guardian_document}
        />
        <Field
          label="Telefone do responsável"
          name="legal_guardian_phone"
          value={documents?.legal_guardian_phone}
        />
        <Field
          label="E-mail do responsável"
          name="legal_guardian_email"
          type="email"
          value={documents?.legal_guardian_email}
        />
        <Field
          label="Arquivo autorização de viagem"
          name="travel_authorization_file"
          value={documents?.travel_authorization_file}
        />
        <Field
          label="Arquivo contrato de agência"
          name="agency_contract_file"
          value={documents?.agency_contract_file}
        />
        <Field
          label="Arquivo comprovante de endereço"
          name="proof_of_address_file"
          value={documents?.proof_of_address_file}
        />
      </div>
      <TextareaField
        label="Dados bancários privados"
        name="banking_info_private"
        value={documents?.banking_info_private}
      />
      <SaveButton>Salvar documentos</SaveButton>
    </form>
  );
}

function MediaTab({ profile }: { profile: ModelProfile }) {
  const { media, model } = profile;

  return (
    <div className="stack">
      <div className="actions">
        <form action={markMediaUpdatedAction.bind(null, model.id)}>
          <button className="button" type="submit">
            Marcar mídia como atualizada
          </button>
        </form>
        <Link className="button secondary" href="/admin/media">
          Abrir Admin Media
        </Link>
      </div>
      <ModelMediaGallery media={media} modelId={model.id} />
    </div>
  );
}

function SkillsTab({ profile }: { profile: ModelProfile }) {
  const { model, modelOptions, skills } = profile;
  const optionsByType = useMemo(
    () => ({
      hobby: optionsForType(modelOptions, "hobby"),
      instrument: optionsForType(modelOptions, "instrument"),
      language: optionsForType(modelOptions, "language"),
      skill: optionsForType(modelOptions, "skill"),
      sport: optionsForType(modelOptions, "sport")
    }),
    [modelOptions]
  );
  const skillFields = [
    ["acting", "Atuação"],
    ["dancing", "Dança"],
    ["singing", "Canto"],
    ["swimming", "Natação"],
    ["surfing", "Surf"],
    ["skating", "Skate"],
    ["skiing", "Ski"],
    ["yoga", "Yoga"],
    ["pilates", "Pilates"],
    ["running", "Corrida"],
    ["gym", "Academia"],
    ["martial_arts", "Artes marciais"],
    ["cycling", "Ciclismo"],
    ["horseback_riding", "Equitação"],
    ["drives_car", "Dirige carro"],
    ["drives_motorcycle", "Dirige moto"],
    ["runway_experience", "Experiência passarela"],
    ["ecommerce_experience", "Experiência e-commerce"],
    ["beauty_experience", "Experiência beauty"],
    ["tv_commercial_experience", "Experiência TVC"]
  ] as const;

  return (
    <div className="skills-manager">
      <form
        action={updateModelSkillsAction.bind(null, model.id)}
        className="form wide-form"
      >
        {skills?.has_drivers_license ? (
          <input name="has_drivers_license" type="hidden" value="on" />
        ) : null}
        <div className="skills-option-sections">
          <section className="skills-option-section">
            <h3>{modelOptionConfig.skill.title}</h3>
            <OptionChecklist
              emptyLabel={modelOptionConfig.skill.emptyLabel}
              name={modelOptionConfig.skill.fieldName}
              options={optionsWithSelected(
                optionsByType.skill,
                skills?.skill_options
              )}
              selectedValues={skills?.skill_options}
            />
          </section>
          <section className="skills-option-section">
            <h3>{modelOptionConfig.sport.title}</h3>
            <OptionChecklist
              emptyLabel={modelOptionConfig.sport.emptyLabel}
              name={modelOptionConfig.sport.fieldName}
              options={optionsWithSelected(
                optionsByType.sport,
                skills?.sport_options
              )}
              selectedValues={skills?.sport_options}
            />
          </section>
          <section className="skills-option-section">
            <h3>{modelOptionConfig.hobby.title}</h3>
            <OptionChecklist
              emptyLabel={modelOptionConfig.hobby.emptyLabel}
              name={modelOptionConfig.hobby.fieldName}
              options={optionsWithSelected(
                optionsByType.hobby,
                skills?.hobby_options
              )}
              selectedValues={skills?.hobby_options}
            />
          </section>
          <section className="skills-option-section">
            <h3>{modelOptionConfig.language.title}</h3>
            <LanguageChecklist
              emptyLabel={modelOptionConfig.language.emptyLabel}
              levels={skills?.language_levels}
              options={optionsWithSelected(
                optionsByType.language,
                skills?.languages
              )}
              selectedValues={skills?.languages}
            />
          </section>
          <section className="skills-option-section">
            <h3>{modelOptionConfig.instrument.title}</h3>
            <OptionChecklist
              emptyLabel={modelOptionConfig.instrument.emptyLabel}
              name={modelOptionConfig.instrument.fieldName}
              options={optionsWithSelected(
                optionsByType.instrument,
                skills?.instruments
              )}
              selectedValues={skills?.instruments}
            />
          </section>
        </div>
        <section className="skills-option-section">
          <h3>Experiências rápidas</h3>
          <div className="checkbox-grid">
            {skillFields.map(([name, label]) => (
              <CheckboxField
                checked={skills?.[name] ?? false}
                key={name}
                label={label}
                name={name}
              />
            ))}
          </div>
        </section>
        <div className="checkbox-row">
          <CheckboxField
            checked={skills?.approved_for_client_view ?? false}
            label="Aprovado para visualização do cliente"
            name="approved_for_client_view"
          />
        </div>
        <SaveButton>Salvar habilidades</SaveButton>
      </form>
      <div className="skills-option-admin">
        <h3>Adicionar opção global</h3>
        <p className="notice">
          Novas opções ficam disponíveis para todos os modelos.
        </p>
        {(
          [
            "skill",
            "sport",
            "hobby",
            "language",
            "instrument"
          ] as ModelOptionType[]
        ).map((optionType) => (
          <AddModelOptionForm
            key={optionType}
            modelId={model.id}
            optionType={optionType}
          />
        ))}
      </div>
    </div>
  );
}

function WorkTab({ profile }: { profile: ModelProfile }) {
  const { model, workHistory } = profile;

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Ano</th>
              <th>Mercado</th>
              <th>Categoria</th>
              <th>Cliente</th>
              <th>Aprovado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {workHistory.map((work) => (
              <tr key={work.id}>
                <td>
                  <strong>{work.brand}</strong>
                  <br />
                  <span className="muted">{work.link ?? work.photographer ?? "-"}</span>
                </td>
                <td>{work.year ?? "-"}</td>
                <td>{work.market ?? "-"}</td>
                <td>{work.category ?? "-"}</td>
                <td>{work.client ?? work.agency ?? "-"}</td>
                <td>{work.approved_for_client_view ? "Sim" : "Não"}</td>
                <td>
                  <form action={deleteModelWorkHistoryAction.bind(null, model.id, work.id)}>
                    <button className="button danger" type="submit">Excluir</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {workHistory.length === 0 ? <p>Nenhum trabalho importante cadastrado.</p> : null}
      </div>
      <form
        action={createModelWorkHistoryAction.bind(null, model.id)}
        className="form wide-form"
      >
        <h3>Adicionar trabalho</h3>
        <div className="grid">
          <Field label="Marca" name="brand" required />
          <Field label="Ano" name="year" type="number" />
          <Field label="Mercado" name="market" />
          <Field label="Categoria" name="category" />
          <Field label="Fotógrafo" name="photographer" />
          <Field label="Cliente" name="client" />
          <Field label="Agência" name="agency" />
          <Field label="Link" name="link" />
        </div>
        <TextareaField label="Notas" name="notes" />
        <div className="checkbox-row">
          <CheckboxField
            label="Aprovado para visualização do cliente"
            name="approved_for_client_view"
          />
        </div>
        <SaveButton>Adicionar trabalho</SaveButton>
      </form>
    </div>
  );
}

function HealthTab({ profile }: { profile: ModelProfile }) {
  const { healthLogistics, model } = profile;

  return (
    <form
      action={updateModelHealthLogisticsAction.bind(null, model.id)}
      className="form wide-form"
    >
      <div className="grid">
        <TextareaField
          label="Restrições alimentares"
          name="food_restrictions"
          value={healthLogistics?.food_restrictions}
        />
        <TextareaField label="Alergias" name="allergies" value={healthLogistics?.allergies} />
        <TextareaField
          label="Medicamentos / notas de saúde"
          name="medications_notes"
          value={healthLogistics?.medications_notes}
        />
        <TextareaField
          label="Disponibilidade para viagem"
          name="travel_availability"
          value={healthLogistics?.travel_availability}
        />
        <TextareaField
          label="Restrições comerciais"
          name="commercial_restrictions"
          value={healthLogistics?.commercial_restrictions}
        />
      </div>
      <div className="checkbox-grid">
        <CheckboxField checked={healthLogistics?.passport_valid} label="Passaporte válido" name="passport_valid" />
        <CheckboxField
          checked={healthLogistics?.can_travel_internationally}
          label="Pode viajar internacionalmente"
          name="can_travel_internationally"
        />
        <CheckboxField
          checked={healthLogistics?.accepts_out_of_city_jobs}
          label="Aceita trabalhos fora da cidade"
          name="accepts_out_of_city_jobs"
        />
        <CheckboxField
          checked={healthLogistics?.accepts_hair_change}
          label="Aceita mudança de cabelo"
          name="accepts_hair_change"
        />
        <CheckboxField checked={healthLogistics?.accepts_lingerie} label="Aceita lingerie" name="accepts_lingerie" />
        <CheckboxField checked={healthLogistics?.accepts_swimwear} label="Aceita swimwear" name="accepts_swimwear" />
        <CheckboxField
          checked={healthLogistics?.accepts_artistic_nudity}
          label="Aceita nudez artística"
          name="accepts_artistic_nudity"
        />
      </div>
      <section className="mini-panel stack">
        <h3>Carteira de motorista</h3>
        <div className="checkbox-row">
          <CheckboxField
            checked={healthLogistics?.has_drivers_license}
            label="Tem carteira de motorista"
            name="has_drivers_license"
          />
        </div>
        <div className="grid">
          <Field
            label="Categoria / tipo"
            name="drivers_license_category"
            value={healthLogistics?.drivers_license_category}
          />
          <Field
            label="Número"
            name="drivers_license_number"
            value={healthLogistics?.drivers_license_number}
          />
          <Field
            label="País"
            name="drivers_license_country"
            value={healthLogistics?.drivers_license_country}
          />
        </div>
        <TextareaField
          label="Observações"
          name="drivers_license_notes"
          value={healthLogistics?.drivers_license_notes}
        />
      </section>
      <SaveButton>Salvar saúde e logística</SaveButton>
    </form>
  );
}

type InternationalAgencyDraft = Pick<
  ModelInternationalAgency,
  | "agency_name"
  | "city"
  | "contract_end_date"
  | "contract_start_date"
  | "country"
> & {
  id: string;
};

function emptyInternationalAgencyDraft(id = "agency-empty"): InternationalAgencyDraft {
  return {
    agency_name: "",
    city: "",
    contract_end_date: "",
    contract_start_date: "",
    country: "",
    id
  };
}

function internationalAgencyDraftsFromProfile(
  internationalAgencies: ModelInternationalAgency[],
  legacyAgencies: string[] | null | undefined
): InternationalAgencyDraft[] {
  if (internationalAgencies.length > 0) {
    return internationalAgencies.map((agency) => ({
      agency_name: agency.agency_name,
      city: agency.city ?? "",
      contract_end_date: agency.contract_end_date ?? "",
      contract_start_date: agency.contract_start_date ?? "",
      country: agency.country ?? "",
      id: agency.id
    }));
  }

  const legacyRows = (legacyAgencies ?? [])
    .filter(Boolean)
    .map((agency, index) => ({
      agency_name: agency,
      city: "",
      contract_end_date: "",
      contract_start_date: "",
      country: "",
      id: `legacy-agency-${index}`
    }));

  return legacyRows.length ? legacyRows : [emptyInternationalAgencyDraft()];
}

function RepresentationTab({ profile }: { profile: ModelProfile }) {
  const { internationalAgencies, model, representation } = profile;
  const [agencyRows, setAgencyRows] = useState<InternationalAgencyDraft[]>(() =>
    internationalAgencyDraftsFromProfile(
      internationalAgencies,
      representation?.international_agencies
    )
  );

  useEffect(() => {
    setAgencyRows(
      internationalAgencyDraftsFromProfile(
        internationalAgencies,
        representation?.international_agencies
      )
    );
  }, [internationalAgencies, representation?.international_agencies]);

  function addAgencyRow() {
    setAgencyRows((rows) => [
      ...rows,
      emptyInternationalAgencyDraft(`agency-new-${Date.now()}-${rows.length}`)
    ]);
  }

  function removeAgencyRow(id: string) {
    setAgencyRows((rows) => rows.filter((row) => row.id !== id));
  }

  return (
    <form
      action={updateModelRepresentationAction.bind(null, model.id)}
      className="form wide-form"
    >
      <input
        name="commercial_status"
        type="hidden"
        value={representation?.commercial_status ?? ""}
      />
      <div className="grid">
        <Field label="Mother agency" name="mother_agency" value={representation?.mother_agency} />
        <Field
          label="Mercados disponíveis"
          name="available_markets"
          value={listValue(representation?.available_markets)}
        />
        <Field
          label="Mercados anteriores"
          name="previous_markets"
          value={listValue(representation?.previous_markets)}
        />
        <Field
          label="Início do contrato"
          name="contract_start_date"
          type="date"
          value={representation?.contract_start_date}
        />
        <Field
          label="Fim do contrato"
          name="contract_end_date"
          type="date"
          value={representation?.contract_end_date}
        />
        <Field
          label="Comissão agência %"
          name="agency_commission"
          type="number"
          value={representation?.agency_commission}
        />
        <Field
          label="Comissão modelo %"
          name="model_commission"
          type="number"
          value={representation?.model_commission}
        />
        <Field
          label="Booker responsável"
          name="responsible_booker"
          value={representation?.responsible_booker}
        />
      </div>
      <div className="checkbox-row">
        <CheckboxField
          checked={representation?.exclusive_contract}
          label="Contrato exclusivo"
          name="exclusive_contract"
        />
      </div>
      <section className="international-agencies-panel">
        <div className="section-heading-row">
          <div>
            <h3>Agências internacionais</h3>
            <p className="notice">
              Cadastre contratos internacionais por agência, país e período.
            </p>
          </div>
          <button className="button secondary" onClick={addAgencyRow} type="button">
            Adicionar agência
          </button>
        </div>
        <div className="international-agency-list">
          {agencyRows.length ? (
            agencyRows.map((agency, index) => (
              <div className="international-agency-row" key={agency.id}>
                <Field
                  label="Nome da agência"
                  name="agency_name"
                  value={agency.agency_name}
                />
                <Field label="País" name="agency_country" value={agency.country} />
                <Field label="Cidade" name="agency_city" value={agency.city} />
                <Field
                  label="Início"
                  name="agency_contract_start_date"
                  type="date"
                  value={agency.contract_start_date}
                />
                <Field
                  label="Término"
                  name="agency_contract_end_date"
                  type="date"
                  value={agency.contract_end_date}
                />
                <div className="agency-row-actions">
                  <span>#{index + 1}</span>
                  <button
                    className="button secondary"
                    onClick={() => removeAgencyRow(agency.id)}
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="notice">Nenhuma agência internacional cadastrada.</p>
          )}
        </div>
      </section>
      <TextareaField
        label="Notas estratégicas"
        name="strategic_notes"
        value={representation?.strategic_notes}
      />
      <SaveButton>Salvar representação</SaveButton>
    </form>
  );
}

function InternalTab({ model }: { model: Model }) {
  return (
    <form
      action={updateModelInternalNotesAction.bind(null, model.id)}
      className="form wide-form"
    >
      <Field label="Tags internas" name="tags" value={model.tags.join(", ")} />
      <TextareaField label="Observações internas" name="notes" value={model.notes} />
      <SaveButton>Salvar observações internas</SaveButton>
    </form>
  );
}

function HistoryTab({ profile }: { profile: ModelProfile }) {
  const { model, updateRequests } = profile;
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyEntries = useMemo(
    () => modelHistoryEntries(model, updateRequests),
    [model, updateRequests]
  );
  const latestEntry = historyEntries[0] ?? {
    actor: "Equipe AROLAB",
    date: model.created_at,
    id: "created",
    origin: "Agência",
    sections: ["Cadastro360"],
    status: "Criado",
    statusTone: "pending",
    summary: "Cadastro do modelo criado.",
    title: "Cadastro criado"
  };

  useEffect(() => {
    if (!historyOpen) {
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [historyOpen]);

  return (
    <div className="history-tab">
      <section className="history-summary">
        <div>
          <span className="eyebrow">Última atualização</span>
          <h3>{latestEntry.title}</h3>
          <p>{formatDateTime(latestEntry.date)}</p>
        </div>
        <div className="history-summary-meta">
          <span className={`history-status ${latestEntry.statusTone}`}>
            {latestEntry.status}
          </span>
          <span>{latestEntry.origin}</span>
          <span>{latestEntry.actor}</span>
        </div>
        <button
          className="history-text-button"
          onClick={() => setHistoryOpen(true)}
          type="button"
        >
          Ver histórico
        </button>
      </section>

      <div className="history-actions">
        <form action={sendModelUpdateRequestAction.bind(null, model.id)}>
          <button className="button secondary" type="submit">
            Solicitar atualização
          </button>
        </form>
        <form action={markProfileReviewedAction.bind(null, model.id)}>
          <button className="button secondary" type="submit">
            Marcar perfil como revisado
          </button>
        </form>
        <form action={markMeasurementsUpdatedAction.bind(null, model.id)}>
          <button className="button secondary" type="submit">
            Marcar medidas como atualizadas
          </button>
        </form>
        <form action={markMediaUpdatedAction.bind(null, model.id)}>
          <button className="button secondary" type="submit">
            Marcar mídia como atualizada
          </button>
        </form>
      </div>

      <div className="history-snapshot-grid">
        <section>
          <span className="eyebrow">Última atualização de perfil</span>
          <strong>{formatDateTime(model.last_profile_update_at)}</strong>
        </section>
        <section>
          <span className="eyebrow">Última atualização de mídia</span>
          <strong>{formatDateTime(model.last_media_update_at)}</strong>
        </section>
        <section>
          <span className="eyebrow">Última atualização de medidas</span>
          <strong>{formatDateTime(model.last_measurements_update_at)}</strong>
        </section>
        <section>
          <span className="eyebrow">Último pedido enviado</span>
          <strong>{formatDateTime(model.last_update_request_sent_at)}</strong>
        </section>
        <section>
          <span className="eyebrow">Perfil revisado em</span>
          <strong>{formatDateTime(model.profile_reviewed_at)}</strong>
        </section>
        <section>
          <span className="eyebrow">Criado em</span>
          <strong>{formatDateTime(model.created_at)}</strong>
        </section>
        <section>
          <span className="eyebrow">Atualizado em</span>
          <strong>{formatDateTime(model.updated_at)}</strong>
        </section>
      </div>

      {historyOpen ? (
        <div
          aria-modal="true"
          className="history-modal-backdrop"
          onClick={() => setHistoryOpen(false)}
          role="dialog"
        >
          <section
            className="history-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Histórico de atualizações</span>
                <h3>Cadastro360</h3>
              </div>
              <button
                aria-label="Fechar histórico"
                className="history-close-button"
                onClick={() => setHistoryOpen(false)}
                type="button"
              >
                X
              </button>
            </header>
            <div className="history-timeline">
              {historyEntries.length > 0 ? (
                historyEntries.map((entry) => (
                  <article className="history-timeline-item" key={entry.id}>
                    <div>
                      <strong>{entry.title}</strong>
                      <span>{formatDateTime(entry.date)}</span>
                    </div>
                    <div className="history-timeline-meta">
                      <span className={`history-status ${entry.statusTone}`}>
                        {entry.status}
                      </span>
                      <span>{entry.origin}</span>
                      <span>{entry.actor}</span>
                    </div>
                    <p>{entry.summary}</p>
                    {entry.sections?.length ? (
                      <small>Seções: {entry.sections.join(", ")}</small>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="history-empty">Nenhuma atualização registrada.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function renderActiveTab(profile: ModelProfile, activeTab: ModelProfileTab) {
  switch (activeTab) {
    case "basic":
      return <BasicTab profile={profile} />;
    case "documents":
      return <DocumentsTab profile={profile} />;
    case "media":
      return <MediaTab profile={profile} />;
    case "skills":
      return <SkillsTab profile={profile} />;
    case "work":
      return <WorkTab profile={profile} />;
    case "health":
      return <HealthTab profile={profile} />;
    case "representation":
      return <RepresentationTab profile={profile} />;
    case "internal":
      return <InternalTab model={profile.model} />;
    case "history":
      return <HistoryTab profile={profile} />;
  }
}

export function ModelProfileEditor({
  activeTab,
  profile
}: ModelProfileEditorProps) {
  const [selectedTab, setSelectedTab] = useState<ModelProfileTab>(activeTab);

  useEffect(() => {
    setSelectedTab(activeTab);
  }, [activeTab]);

  function selectTab(tab: ModelProfileTab) {
    setSelectedTab(tab);

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("saved");
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="stack model-profile-editor">
      <nav
        aria-label="Abas do perfil do modelo"
        className="tabs"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          overflowX: "auto"
        }}
      >
        {modelProfileTabs.map((tab) => (
          <button
            aria-selected={selectedTab === tab.id}
            className={`tab-link${selectedTab === tab.id ? " active" : ""}`}
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            role="tab"
            style={{
              background:
                selectedTab === tab.id
                  ? "color-mix(in srgb, var(--foreground) 8%, transparent)"
                  : "transparent",
              border: "1px solid var(--line)",
              borderRadius: "999px",
              color: "var(--foreground)",
              cursor: "pointer",
              display: "inline-flex",
              font: "inherit",
              fontWeight: selectedTab === tab.id ? 700 : 500,
              padding: "0.65rem 0.9rem",
              textDecoration: "none",
              whiteSpace: "nowrap"
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <section className="panel stack">{renderActiveTab(profile, selectedTab)}</section>
      <style>{`
        .model-profile-editor .panel {
          font-size: 0.92rem;
          max-width: 100%;
          overflow: hidden;
        }

        .model-profile-editor label,
        .model-profile-editor .notice {
          font-size: 0.86rem;
        }

        .model-profile-editor .button.secondary {
          font-size: 0.8rem;
          min-height: 34px;
          padding: 0.4rem 0.68rem;
        }

        .consolidated-basic-form,
        .profile-form-section {
          display: grid;
          gap: 0.85rem;
        }

        .profile-form-section {
          background:
            linear-gradient(180deg, rgba(10, 30, 55, 0.74), rgba(13, 38, 68, 0.58)),
            color-mix(in srgb, #102a4a 82%, var(--panel));
          border: 1px solid color-mix(in srgb, #6eb6ff 16%, transparent);
          border-radius: 8px;
          padding: 0.9rem;
          min-width: 0;
        }

        .profile-form-section h3,
        .international-agencies-panel h3 {
          color: color-mix(in srgb, #e8f4ff 92%, white);
          font-size: 0.95rem;
          font-weight: 680;
          letter-spacing: 0;
          margin: 0;
        }

        .compact-stack {
          gap: 0.45rem;
        }

        .field-label {
          color: color-mix(in srgb, #aacfe8 88%, white);
          display: inline-flex;
          font-size: 0.82rem;
          font-weight: 650;
        }

        .category-chip-field {
          display: grid;
          gap: 0.45rem;
        }

        .international-agencies-panel {
          background:
            linear-gradient(180deg, rgba(10, 30, 55, 0.72), rgba(13, 38, 68, 0.54)),
            color-mix(in srgb, #102a4a 82%, var(--panel));
          border: 1px solid color-mix(in srgb, #6eb6ff 16%, transparent);
          border-radius: 8px;
          display: grid;
          gap: 0.85rem;
          padding: 0.9rem;
          min-width: 0;
        }

        .section-heading-row {
          align-items: flex-start;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .section-heading-row .notice {
          margin: 0.2rem 0 0;
        }

        .international-agency-list {
          display: grid;
          gap: 0.6rem;
          min-width: 0;
        }

        .international-agency-row {
          align-items: end;
          background: rgba(6, 22, 42, 0.28);
          border: 1px solid rgba(126, 196, 255, 0.14);
          border-radius: 8px;
          display: grid;
          gap: 0.55rem;
          grid-template-columns: minmax(10rem, 1.3fr) minmax(7rem, 0.8fr) minmax(7rem, 0.8fr) minmax(8rem, 0.75fr) minmax(8rem, 0.75fr) auto;
          padding: 0.65rem;
          min-width: 0;
        }

        .international-agency-row label {
          gap: 0.3rem;
        }

        .agency-row-actions {
          align-items: center;
          display: flex;
          gap: 0.45rem;
          justify-content: flex-end;
        }

        .agency-row-actions span {
          color: color-mix(in srgb, #aacfe8 72%, white);
          font-size: 0.76rem;
          font-weight: 700;
        }

        .history-tab {
          display: grid;
          gap: 1rem;
        }

        .history-summary {
          align-items: center;
          background:
            linear-gradient(135deg, rgba(9, 28, 52, 0.95), rgba(15, 47, 82, 0.88)),
            color-mix(in srgb, #102a4a 88%, var(--panel));
          border: 1px solid color-mix(in srgb, #6eb6ff 22%, transparent);
          border-radius: 8px;
          display: grid;
          gap: 0.9rem;
          grid-template-columns: minmax(0, 1fr) auto auto;
          padding: 0.9rem;
          min-width: 0;
        }

        .history-summary h3 {
          color: color-mix(in srgb, #eef8ff 94%, white);
          font-size: 1rem;
          letter-spacing: 0;
          margin: 0.15rem 0 0;
        }

        .history-summary p,
        .history-summary-meta,
        .history-timeline-item p,
        .history-timeline-item small,
        .history-empty {
          color: color-mix(in srgb, #aacfe8 86%, white);
          font-size: 0.8rem;
          margin: 0;
        }

        .history-summary-meta,
        .history-timeline-meta {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          justify-content: flex-end;
        }

        .history-summary-meta > span:not(.history-status),
        .history-timeline-meta > span:not(.history-status) {
          border: 1px solid color-mix(in srgb, #86c8ff 18%, transparent);
          border-radius: 999px;
          padding: 0.28rem 0.52rem;
        }

        .history-status {
          border: 1px solid color-mix(in srgb, #86c8ff 28%, transparent);
          border-radius: 999px;
          color: #f5fbff;
          display: inline-flex;
          font-size: 0.74rem;
          font-weight: 700;
          line-height: 1;
          padding: 0.32rem 0.54rem;
        }

        .history-status.positive {
          background: color-mix(in srgb, #2f8ac6 42%, transparent);
        }

        .history-status.pending {
          background: color-mix(in srgb, #1d4f80 58%, transparent);
        }

        .history-status.negative {
          background: color-mix(in srgb, #9f3f68 42%, transparent);
        }

        .history-text-button,
        .history-close-button {
          background: color-mix(in srgb, #1d4f80 76%, transparent);
          border: 1px solid color-mix(in srgb, #86c8ff 28%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, #e8f6ff 92%, white);
          cursor: pointer;
          font: inherit;
          font-size: 0.78rem;
          min-height: 32px;
          padding: 0.34rem 0.68rem;
        }

        .history-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .history-snapshot-grid {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        }

        .history-snapshot-grid section {
          background: color-mix(in srgb, #0c2848 62%, transparent);
          border: 1px solid color-mix(in srgb, #86c8ff 16%, var(--line));
          border-radius: 8px;
          display: grid;
          gap: 0.28rem;
          min-height: 4.35rem;
          padding: 0.65rem;
        }

        .history-snapshot-grid strong {
          color: var(--foreground);
          font-size: 0.84rem;
          line-height: 1.2;
        }

        .history-modal-backdrop {
          align-items: center;
          background: rgba(5, 12, 22, 0.72);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 1rem;
          position: fixed;
          z-index: 1000;
        }

        .history-modal {
          background:
            linear-gradient(180deg, rgba(9, 28, 52, 0.98), rgba(13, 38, 68, 0.95)),
            #0c2848;
          border: 1px solid color-mix(in srgb, #86c8ff 26%, transparent);
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
          color: color-mix(in srgb, #eef8ff 94%, white);
          display: grid;
          gap: 1rem;
          max-height: min(82dvh, 720px);
          max-width: 760px;
          overflow: hidden;
          padding: 1rem;
          width: min(94vw, 760px);
        }

        .history-modal header {
          align-items: center;
          border-bottom: 1px solid color-mix(in srgb, #86c8ff 16%, transparent);
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 0.75rem;
        }

        .history-modal h3 {
          font-size: 1rem;
          letter-spacing: 0;
          margin: 0.15rem 0 0;
        }

        .history-close-button {
          min-width: 34px;
          padding-inline: 0.5rem;
        }

        .history-timeline {
          display: grid;
          gap: 0.65rem;
          overflow: auto;
          padding-right: 0.2rem;
        }

        .history-timeline-item {
          background: rgba(7, 23, 42, 0.42);
          border: 1px solid rgba(126, 196, 255, 0.14);
          border-radius: 8px;
          display: grid;
          gap: 0.5rem;
          padding: 0.75rem;
        }

        .history-timeline-item > div:first-child {
          align-items: baseline;
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          justify-content: space-between;
        }

        .history-timeline-item strong {
          color: color-mix(in srgb, #eef8ff 94%, white);
          font-size: 0.9rem;
        }

        .history-timeline-item > div:first-child span {
          color: color-mix(in srgb, #aacfe8 82%, white);
          font-size: 0.76rem;
        }

        .skills-manager {
          display: grid;
          gap: 1rem;
          grid-template-columns: minmax(0, 1fr) minmax(15rem, 22rem);
        }

        .skills-option-sections,
        .skills-option-admin {
          display: grid;
          gap: 1rem;
        }

        .skills-option-section {
          background:
            linear-gradient(180deg, rgba(10, 30, 55, 0.92), rgba(13, 38, 68, 0.84)),
            color-mix(in srgb, #102a4a 88%, var(--panel));
          border: 1px solid color-mix(in srgb, #6eb6ff 22%, transparent);
          border-radius: 8px;
          display: grid;
          gap: 0.75rem;
          padding: 0.85rem;
          min-width: 0;
        }

        .skills-option-section h3,
        .skills-option-admin h3 {
          color: color-mix(in srgb, #e8f4ff 92%, white);
          font-size: 0.95rem;
          font-weight: 680;
          letter-spacing: 0;
          margin: 0;
        }

        .option-chip-grid,
        .language-option-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          min-width: 0;
        }

        .option-chip {
          align-items: center;
          background: color-mix(in srgb, #173a63 76%, transparent);
          border: 1px solid color-mix(in srgb, #86c8ff 24%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, #c7e8ff 92%, white);
          cursor: pointer;
          display: inline-flex;
          font-size: 0.82rem;
          font-weight: 620;
          gap: 0.4rem;
          min-height: 34px;
          padding: 0.38rem 0.62rem;
          position: relative;
          transition:
            background 150ms ease,
            border-color 150ms ease,
            box-shadow 150ms ease,
            color 150ms ease,
            transform 150ms ease;
          user-select: none;
          white-space: nowrap;
        }

        .option-chip:hover {
          background: color-mix(in srgb, #23517f 84%, transparent);
          border-color: color-mix(in srgb, #9bd4ff 40%, transparent);
        }

        .option-chip.is-selected,
        .option-chip:has(input:checked) {
          background: linear-gradient(135deg, rgba(50, 126, 198, 0.94), rgba(35, 91, 154, 0.92));
          border-color: color-mix(in srgb, #b9e4ff 58%, transparent);
          box-shadow: 0 8px 22px rgba(21, 74, 124, 0.24);
          color: #f5fbff;
        }

        .option-chip input {
          height: 1px;
          margin: 0;
          opacity: 0;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          width: 1px;
        }

        .option-chip:focus-within {
          box-shadow:
            0 0 0 2px rgba(13, 38, 68, 0.94),
            0 0 0 4px rgba(116, 197, 255, 0.42);
          outline: none;
        }

        .option-chip span {
          line-height: 1;
        }

        .language-option-row {
          align-items: center;
          background: rgba(6, 22, 42, 0.28);
          border: 1px solid rgba(126, 196, 255, 0.14);
          border-radius: 999px;
          display: inline-flex;
          gap: 0.35rem;
          padding: 0.16rem;
        }

        .language-option-row select {
          appearance: none;
          background: color-mix(in srgb, #0b2441 86%, transparent);
          border: 1px solid color-mix(in srgb, #86c8ff 22%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, #d7efff 92%, white);
          font-size: 0.78rem;
          min-height: 34px;
          padding: 0.35rem 1.45rem 0.35rem 0.62rem;
        }

        .option-add-form {
          background: color-mix(in srgb, #0c2848 72%, transparent);
          border: 1px solid color-mix(in srgb, #86c8ff 18%, transparent);
          border-radius: 8px;
          display: grid;
          gap: 0.5rem;
          padding: 0.62rem;
        }

        .option-add-form label {
          display: grid;
          gap: 0.3rem;
        }

        .option-add-form span {
          color: color-mix(in srgb, #aacfe8 88%, white);
          font-size: 0.76rem;
        }

        .option-add-form input {
          background: color-mix(in srgb, #081d35 84%, transparent);
          border: 1px solid color-mix(in srgb, #86c8ff 22%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, #eef8ff 92%, white);
          font: inherit;
          font-size: 0.82rem;
          min-height: 34px;
          padding: 0.38rem 0.7rem;
        }

        .option-add-form input::placeholder {
          color: color-mix(in srgb, #9bbdd5 72%, transparent);
        }

        .option-add-form .button {
          background: color-mix(in srgb, #1d4f80 76%, transparent);
          border-color: color-mix(in srgb, #86c8ff 28%, transparent);
          color: color-mix(in srgb, #e8f6ff 92%, white);
          font-size: 0.78rem;
          justify-self: start;
          min-height: 32px;
          padding: 0.34rem 0.68rem;
        }

        .skills-option-section .checkbox-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .skills-option-section .checkbox-grid label {
          align-items: center;
          background: color-mix(in srgb, #173a63 76%, transparent);
          border: 1px solid color-mix(in srgb, #86c8ff 24%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, #c7e8ff 92%, white);
          cursor: pointer;
          display: inline-flex;
          font-size: 0.82rem;
          font-weight: 620;
          min-height: 34px;
          padding: 0.38rem 0.62rem;
          position: relative;
          white-space: nowrap;
        }

        .skills-option-section .checkbox-grid label:has(input:checked) {
          background: linear-gradient(135deg, rgba(50, 126, 198, 0.94), rgba(35, 91, 154, 0.92));
          border-color: color-mix(in srgb, #b9e4ff 58%, transparent);
          color: #f5fbff;
        }

        .skills-option-section .checkbox-grid input {
          height: 1px;
          opacity: 0;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          width: 1px;
        }

        .skills-option-section .checkbox-grid label:focus-within {
          box-shadow:
            0 0 0 2px rgba(13, 38, 68, 0.94),
            0 0 0 4px rgba(116, 197, 255, 0.42);
        }

        @media (max-width: 980px) {
          .skills-manager {
            grid-template-columns: 1fr;
          }

          .international-agency-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .history-summary {
            align-items: flex-start;
            grid-template-columns: 1fr;
          }

          .history-summary-meta {
            justify-content: flex-start;
          }
        }

        @media (max-width: 620px) {
          .model-profile-editor .panel {
            padding: 0.75rem;
          }

          .model-profile-editor .tabs {
            gap: 0.35rem;
            padding-bottom: 0.55rem;
          }

          .model-profile-editor .tab-link {
            min-height: 38px;
            padding: 0.48rem 0.7rem;
          }

          .profile-form-section,
          .international-agencies-panel,
          .skills-option-section {
            padding: 0.72rem;
          }

          .option-chip,
          .skills-option-section .checkbox-grid label {
            white-space: normal;
            min-width: 0;
          }

          .language-option-row {
            align-items: stretch;
            border-radius: 8px;
            display: grid;
            width: 100%;
          }

          .language-option-row .option-chip,
          .language-option-row select {
            width: 100%;
          }

          .section-heading-row,
          .agency-row-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .international-agency-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
