/** IMEI: 15 digits with a Luhn check digit. */
export function normalizeImei(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 15) return null;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0 ? digits : null;
}
