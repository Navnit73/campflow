export function generateConfirmationCode(prefix = "RV"): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Remove ambiguous characters like 0/O, 1/I
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}
