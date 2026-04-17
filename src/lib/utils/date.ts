const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const getDaysUntil = (dateString: string): number => {
  const now = new Date();
  const target = new Date(dateString);
  return Math.ceil((target.getTime() - now.getTime()) / DAY_IN_MS);
};

export const getExpiryTone = (dateString: string): "success" | "warning" | "danger" => {
  const days = getDaysUntil(dateString);
  if (days < 0) {
    return "danger";
  }
  if (days <= 30) {
    return "warning";
  }
  return "success";
};
