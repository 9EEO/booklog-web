const pad = (value: number) => value.toString().padStart(2, '0')

export const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remain = seconds % 60

  return `${pad(hours)}:${pad(minutes)}:${pad(remain)}`
}
