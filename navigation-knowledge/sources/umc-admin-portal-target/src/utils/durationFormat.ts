
const durationFormat = (minutes: number): string => {
  if (isNaN(minutes) || minutes < 0) {
    return '0m';
  }

  const minutesPerDay = 1440;
  const minutesPerHour = 60;

  if (minutes >= minutesPerDay) {
    const days = Math.floor(minutes / minutesPerDay);
    return `${days}d`;
  } else if (minutes >= minutesPerHour) {
    const hours = Math.floor(minutes / minutesPerHour);
    return `${hours}h`;
  } else {
    return `${Math.floor(minutes)}m`;
  }
};

export default durationFormat;