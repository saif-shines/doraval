export type Probe = {
  id: string;
  organizationId: string;
  payload: "hello";
  status: "pending" | "acked";
};

export class MemoryProbeStore {
  private rows = new Map<string, Probe>();
  private n = 0;

  create(organizationId: string): Probe {
    const row: Probe = {
      id: `prb_${++this.n}`,
      organizationId,
      payload: "hello",
      status: "pending",
    };
    this.rows.set(row.id, row);
    return row;
  }

  get(id: string): Probe | undefined {
    return this.rows.get(id);
  }

  ack(id: string, organizationId: string): Probe | undefined {
    const row = this.rows.get(id);
    if (!row || row.organizationId !== organizationId) return undefined;
    row.status = "acked";
    return row;
  }

  pending(organizationId: string): Probe[] {
    return [...this.rows.values()].filter(
      (r) => r.organizationId === organizationId && r.status === "pending",
    );
  }
}
