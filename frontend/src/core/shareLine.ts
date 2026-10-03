/** One stop, handed to one person. The rest of the log stays here. */
export function shareStop(person: string, stop: { name: string }): string {
  return `${person}: ${stop.name}`;
}

/** One bill, handed to one person. The rest of the log stays here. */
export function shareBill(person: string, bill: { name: string; amount: number }): string {
  return `${person}: ${bill.name}, ${bill.amount}`;
}
