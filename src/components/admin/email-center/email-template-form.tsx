import type { EmailTemplate } from "@/lib/communications/data";

export const emailTemplateCategoryOptions = [
  ["model_presentation", "Apresentação"],
  ["shortlist", "Shortlist"],
  ["casting_selection", "Casting"],
  ["profile_update_full", "Atualização de perfil"],
  ["reminder", "Lembrete"],
  ["follow_up", "Follow-up"],
  ["direct_booking", "Direct booking"],
  ["international_placement", "International placement"],
  ["custom", "Custom"]
] as const;

export function EmailTemplateForm({
  action,
  submitLabel,
  template
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  template?: EmailTemplate | null;
}) {
  return (
    <form action={action} className="admin-form-grid">
      <label className="admin-field">
        <span>Nome</span>
        <input defaultValue={template?.name ?? ""} name="name" required />
      </label>
      <label className="admin-field">
        <span>Categoria</span>
        <select defaultValue={template?.category ?? "custom"} name="category">
          {emailTemplateCategoryOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Idioma</span>
        <select defaultValue={template?.language ?? "pt-BR"} name="language">
          <option value="pt-BR">Português</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Assunto</span>
        <input defaultValue={template?.subject ?? ""} name="subject" required />
      </label>
      <label className="admin-field span-2">
        <span>Mensagem</span>
        <textarea defaultValue={template?.body_text ?? ""} name="body_text" required rows={16} />
      </label>
      <div className="actions">
        <button className="button" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
