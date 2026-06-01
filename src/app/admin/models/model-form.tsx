import type { Model } from "@/types/database";

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

      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
