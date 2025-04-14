export interface Endereco {
  estado: string;
  cidade: string;
  bairro: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  latitude: number;
  longitude: number;
}

export interface Imovel {
  id: string;
  tipo_imovel: string;
  endereco: string;
  valor: string;
  valor_avaliacao?: string;
  desconto: string;
  descricao?: string;
  area_total?: string;
  area_privativa?: string;
  area?: string;
  imagem_url?: string;
  quartos?: number;
  modalidade_venda?: string;
  condicao_imovel?: string;
  matricula?: string;
  oferta?: string;
  preco_venda?: string;
  preco_primeira_venda?: string;
  preco_segunda_venda?: string;
  desconto_primeira_venda?: string;
  desconto_segunda_venda?: string;
  edital?: string;
  leilao?: string;
  lote?: string;
  link_imovel?: string;
  link_edital?: string;
  link_proposta?: string;
  data_leilao?: string;
  data_criacao: string;
  data_atualizacao: string;
  latitude: number;
  longitude: number;
  estado: string;
  cidade: string;
  bairro: string;
  codigo: string;
}

export interface ApiResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
} 