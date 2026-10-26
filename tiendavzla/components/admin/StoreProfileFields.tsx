// Campos de la configuración de la tienda (nombre, WhatsApp y Pago Móvil).
import type { StoreSettings } from "@/lib/api/types";
import { VENEZUELA_BANKS } from "@/lib/banks";
import { Field, inputClass } from "@/components/ui/form";

interface StoreProfileFieldsProps {
  values: StoreSettings;
  errors: Record<string, string>;
  onChange: (field: keyof StoreSettings, value: string) => void;
}

export default function StoreProfileFields({ values, errors, onChange }: StoreProfileFieldsProps) {
  const input = (field: keyof StoreSettings) => ({
    id: field,
    value: values[field],
    onChange: (e: { target: { value: string } }) => onChange(field, e.target.value),
    "aria-invalid": Boolean(errors[field]),
    className: inputClass(Boolean(errors[field])),
  });

  return (
    <>
      <Field id="storeName" label="Nombre de la tienda" error={errors.storeName}>
        <input {...input("storeName")} placeholder="Ej: Hogar Práctico VE" maxLength={80} />
      </Field>
      <Field
        id="whatsapp"
        label="WhatsApp de la tienda"
        error={errors.whatsapp}
        hint="Aquí te escriben los clientes"
      >
        <input {...input("whatsapp")} type="tel" inputMode="tel" placeholder="0414 1234567" />
      </Field>

      <fieldset className="space-y-4 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-bold">Pago Móvil donde reciben los pagos</legend>
        <Field id="pagoMovilBank" label="Banco" error={errors.pagoMovilBank}>
          <select {...input("pagoMovilBank")}>
            <option value="" disabled>
              Selecciona tu banco…
            </option>
            {VENEZUELA_BANKS.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pagoMovilPhone" label="Teléfono afiliado" error={errors.pagoMovilPhone}>
            <input {...input("pagoMovilPhone")} type="tel" inputMode="tel" placeholder="0414 1234567" />
          </Field>
          <Field id="pagoMovilId" label="Cédula o RIF" error={errors.pagoMovilId}>
            <input {...input("pagoMovilId")} placeholder="V-12345678" />
          </Field>
        </div>
      </fieldset>
    </>
  );
}
