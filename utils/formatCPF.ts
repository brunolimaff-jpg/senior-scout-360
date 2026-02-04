
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return 'PENDENTE';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  // Mascaramento: 123.***.***-00
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
}
