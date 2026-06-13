"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  Model,
  ModelOption,
  ModelOptionType,
  ModelProfile
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
  { id: "basic", label: "Perfil básico" },
  { id: "measurements", label: "Medidas" },
  { id: "contact", label: "Contato e endereço" },
  { id: "social", label: "Redes sociais" },
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

function listValue(values: string[] | null | undefined) {
  return values?.length ? values.join(", ") : "";
}

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

function BasicTab({ model }: { model: Model }) {
  return (
    <form action={updateModelBasicAction.bind(null, model.id)} className="form wide-form">
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
        <Field
          label="Categorias"
          name="categories"
          value={model.categories.join(", ")}
        />
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
      <SaveButton>Salvar perfil básico</SaveButton>
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

function RepresentationTab({ profile }: { profile: ModelProfile }) {
  const { model, representation } = profile;

  return (
    <form
      action={updateModelRepresentationAction.bind(null, model.id)}
      className="form wide-form"
    >
      <div className="grid">
        <Field label="Mother agency" name="mother_agency" value={representation?.mother_agency} />
        <Field
          label="Agências internacionais"
          name="international_agencies"
          value={listValue(representation?.international_agencies)}
        />
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
        <Field
          label="Status comercial"
          name="commercial_status"
          value={representation?.commercial_status}
        />
      </div>
      <div className="checkbox-row">
        <CheckboxField
          checked={representation?.exclusive_contract}
          label="Contrato exclusivo"
          name="exclusive_contract"
        />
      </div>
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

  return (
    <div className="stack">
      <div className="actions">
        <form action={sendModelUpdateRequestAction.bind(null, model.id)}>
          <button className="button" type="submit">
            Enviar pedido de atualização por e-mail
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
      <div className="grid">
        <section className="mini-panel">
          <span className="eyebrow">Última atualização de perfil</span>
          <strong>{formatDateTime(model.last_profile_update_at)}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Última atualização de mídia</span>
          <strong>{formatDateTime(model.last_media_update_at)}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Última atualização de medidas</span>
          <strong>{formatDateTime(model.last_measurements_update_at)}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Último pedido enviado</span>
          <strong>{formatDateTime(model.last_update_request_sent_at)}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Perfil revisado em</span>
          <strong>{formatDateTime(model.profile_reviewed_at)}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Criado em</span>
          <strong>{formatDateTime(model.created_at)}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Atualizado em</span>
          <strong>{formatDateTime(model.updated_at)}</strong>
        </section>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Enviado em</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Seções</th>
            </tr>
          </thead>
          <tbody>
            {updateRequests.map((request) => (
              <tr key={request.id}>
                <td>{formatDateTime(request.sent_at)}</td>
                <td>{request.email_to ?? "-"}</td>
                <td><span className="status">{request.status}</span></td>
                <td>{request.requested_sections.join(", ") || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {updateRequests.length === 0 ? <p>Nenhum pedido de atualização enviado.</p> : null}
      </div>
    </div>
  );
}

function renderActiveTab(profile: ModelProfile, activeTab: ModelProfileTab) {
  switch (activeTab) {
    case "basic":
      return <BasicTab model={profile.model} />;
    case "measurements":
      return <MeasurementsTab model={profile.model} />;
    case "contact":
      return <ContactTab model={profile.model} />;
    case "social":
      return <SocialTab profile={profile} />;
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
    <div className="stack">
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
              border: "1px solid var(--border)",
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
        }

        @media (max-width: 620px) {
          .option-chip,
          .skills-option-section .checkbox-grid label {
            white-space: normal;
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
        }
      `}</style>
    </div>
  );
}
