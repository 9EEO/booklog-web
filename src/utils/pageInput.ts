export const parsePageInput = (value: string) => {
  const digits = value.replace(/\D/g, '')
  const withoutLeadingZero = digits.replace(/^0+(?=\d)/, '')

  return Number(withoutLeadingZero || 0)
}
