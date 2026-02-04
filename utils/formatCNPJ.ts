
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return 'N/A';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj; // Retorna original se inválido
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}
