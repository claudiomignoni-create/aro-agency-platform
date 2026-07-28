import {
  AdminDateField,
  AdminSelectField
} from "@/components/admin/admin-ui";
import {
  emailCenterPeriodOptions,
  type EmailCenterPeriod
} from "@/lib/communications/email-center";

export function EmailPeriodFilter({ period }: { period: EmailCenterPeriod }) {
  return (
    <details className="email-period-filter">
      <summary aria-label={`Período atual: ${period.label}`}>
        <span>Período</span>
        <strong>{period.label}</strong>
      </summary>
      <form className="email-period-popover" method="get">
        <AdminSelectField
          defaultValue={period.key}
          label="Visualização"
          name="period"
          options={[...emailCenterPeriodOptions]}
        />
        <div className="email-custom-period">
          <AdminDateField defaultValue={period.startDate} label="De" name="start" />
          <AdminDateField defaultValue={period.endDate} label="Até" name="end" />
        </div>
        <p>As datas personalizadas são usadas quando “Personalizado” estiver selecionado.</p>
        <button className="button" type="submit">Aplicar período</button>
      </form>
    </details>
  );
}
