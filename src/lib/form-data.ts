export function nullableString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length ? value : null;
}

export function requiredString(formData: FormData, key: string) {
  const value = nullableString(formData, key);

  if (!value) {
    throw new Error(`Campo obrigatório: ${key}`);
  }

  return value;
}

export function nullableNumber(formData: FormData, key: string) {
  const value = nullableString(formData, key);

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    throw new Error(`Número inválido: ${key}`);
  }

  return numberValue;
}

export function stringList(formData: FormData, key: string) {
  const value = nullableString(formData, key);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
