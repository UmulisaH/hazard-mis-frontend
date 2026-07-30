export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getTodayDateInputValue(referenceDate: Date = new Date()) {
  return toDateInputValue(referenceDate);
}

export function isPastDateInputValue(
  value: string,
  referenceDate: Date = new Date(),
) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  return trimmedValue < getTodayDateInputValue(referenceDate);
}
