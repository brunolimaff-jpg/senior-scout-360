
import React, { useState, useEffect } from 'react';
import { AccountData, OutputProfile } from '../types';
import { fetchCnpjData, normalizeLocation, fetchMunicipalitiesByUf, IbgeCity } from '../services/apiService';
import { findCnpjByName } from '../services/geminiService';
import { MapPin, Building2, Globe, AlertCircle, Loader2, ArrowRightCircle, CheckCircle2, Search, Zap, Sparkles } from 'lucide-react';

interface Props {
  data: AccountData;
  onUpdate: (data: AccountData) => void;
  onNext: () => void;
}

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const Step1Account: React.FC<Props> = ({ data, onUpdate, onNext }) => {
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingNameSearch, setLoadingNameSearch] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingData, setPendingData] = useState<{name: string, city: string, uf: string} | null>(null);
  
  const [availableCities, setAvailableCities] = useState<IbgeCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // 1. Otimização: Busca automática de cidades quando UF muda
  useEffect(() => {
    const loadCities = async () => {
      // Defensive check: uf must be defined and 2 chars
      if (data.uf && data.uf.length === 2) {
        setLoadingCities(true);
        try {
          const cities = await fetchMunicipalitiesByUf(data.uf);
          setAvailableCities(cities);
        } catch (error) {
          console.error("Erro IBGE:", error);
        } finally {
          setLoadingCities(false);
        }
      } else {
        setAvailableCities([]);
      }
    };
    loadCities();
  }, [data.uf]);

  // 2. Validação de CNPJ com Debounce de 500ms
  useEffect(() => {
    // Defensive check for CNPJ
    const rawCnpj = data.cnpj || '';
    const cleanCnpj = rawCnpj.replace(/[^\d]/g, '');
    
    // Reset se estiver vazio
    if (!cleanCnpj) {
      setErrorMsg('');
      return;
    }

    if (cleanCnpj.length === 14) {
      const timer = setTimeout(async () => {
        setLoadingCnpj(true);
        setErrorMsg('');
        
        try {
          const result = await fetchCnpjData(cleanCnpj);
          if (result) {
            const normalizedCity = await normalizeLocation(result.municipio, result.uf);
            const newCompanyName = result.nome_fantasia || result.razao_social || '';
            
            const newData = { name: newCompanyName, city: normalizedCity, uf: result.uf };

            // Se os dados forem diferentes do atual, sugere a troca
            if ((data.companyName && data.companyName !== newCompanyName) || (data.uf && data.uf !== result.uf)) {
              setPendingData(newData);
            } else {
              // Preenchimento automático se o campo estiver vazio ou for idêntico
              onUpdate({ ...data, companyName: newData.name, municipality: newData.city, uf: newData.uf });
            }
          } else {
            setErrorMsg('CNPJ não encontrado na base pública.');
          }
        } catch (e) {
          setErrorMsg('Erro ao consultar Receita.');
        } finally {
          setLoadingCnpj(false);
        }
      }, 500); // 500ms debounce

      return () => clearTimeout(timer);
    }
  }, [data.cnpj]);

  const applyPendingData = () => {
    if (pendingData) {
      onUpdate({
        ...data,
        companyName: pendingData.name,
        municipality: pendingData.city,
        uf: pendingData.uf
      });
      setPendingData(null);
    }
  };

  const handleNameSearch = async () => {
    if (!data.companyName || data.companyName.length < 3) return;
    
    setLoadingNameSearch(true);
    setErrorMsg('');
    try {
      // 1. Busca CNPJ via Gemini (Google Search)
      const foundCnpj = await findCnpjByName(data.companyName, data.uf || '');
      
      if (foundCnpj) {
        // 2. Se achou, atualiza o state. Isso vai triggar o useEffect do CNPJ acima
        // que vai buscar os dados oficiais na BrasilAPI
        onUpdate({ ...data, cnpj: foundCnpj });
      } else {
        setErrorMsg('Nenhum CNPJ encontrado para este nome.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Erro na busca inteligente.');
    } finally {
      setLoadingNameSearch(false);
    }
  };

  // Safe validation preventing "cannot read properties of undefined (reading 'length')"
  const isFormValid = (data.companyName?.trim()?.length || 0) > 0 && (data.uf?.length || 0) === 2;

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="bg-indigo-100 p-2 rounded-lg">
           <Building2 className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Dados da Conta</h2>
          <p className="text-xs text-slate-500">Identificação inicial do cliente alvo</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Company Name (Moved Up for priority flow "User inputs Name") */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Empresa *</label>
          <div className="relative">
            <input
              type="text"
              value={data.companyName || ''}
              onChange={(e) => onUpdate({ ...data, companyName: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSearch()}
              className="w-full p-3 pr-12 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
              placeholder="Ex: Bom Futuro Agrícola"
            />
            <button 
              onClick={handleNameSearch}
              disabled={loadingNameSearch || !data.companyName}
              className="absolute right-2 top-2 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md transition disabled:opacity-50"
              title="Busca Mágica de Dados (IA)"
            >
              {loadingNameSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Dica: Digite o nome e clique na estrela para encontrar o CNPJ automaticamente.</p>
        </div>

        {/* CNPJ Input */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">CNPJ <span className="text-slate-400 font-normal">(Opcional, mas recomendado)</span></label>
          <div className="relative">
            <input
              type="text"
              value={data.cnpj || ''}
              onChange={(e) => onUpdate({ ...data, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className={`w-full p-3 pl-4 border rounded-lg bg-white text-slate-900 transition outline-none font-mono ${errorMsg ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'}`}
            />
            {loadingCnpj && <Loader2 className="w-5 h-5 animate-spin absolute right-3 top-3.5 text-indigo-500" />}
            {!loadingCnpj && !errorMsg && (data.cnpj || '').length >= 14 && <CheckCircle2 className="w-5 h-5 absolute right-3 top-3.5 text-green-500" />}
          </div>
          {errorMsg && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errorMsg}</p>}
          
          {/* 3. High Contrast Pending Data Notification */}
          {pendingData && (
            <div className="mt-3 p-4 bg-slate-900 rounded-xl shadow-lg border border-slate-800 animate-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <div className="bg-green-500/20 p-1.5 rounded-full mt-0.5">
                   <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white text-sm font-bold mb-1">Dados Encontrados na Receita</h4>
                  <div className="text-slate-300 text-xs space-y-1">
                     <p><span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">Razão Social:</span> {pendingData.name}</p>
                     <p><span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">Localização:</span> {pendingData.city}/{pendingData.uf}</p>
                  </div>
                </div>
                <button 
                  onClick={applyPendingData} 
                  className="bg-white hover:bg-slate-100 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Usar Dados
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Location Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">UF *</label>
            <select
              value={data.uf || ''}
              onChange={(e) => onUpdate({ ...data, uf: e.target.value.toUpperCase(), municipality: '' })}
              className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="">Selecione</option>
              {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 relative">
            <label className="block text-sm font-bold text-slate-700 mb-1">Município</label>
            <div className="relative">
              <input
                type="text"
                value={data.municipality || ''}
                onChange={(e) => onUpdate({ ...data, municipality: e.target.value })}
                list="step1-cities-list"
                disabled={!data.uf}
                className="w-full p-3 pl-10 border border-slate-300 rounded-lg bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                placeholder={loadingCities ? "Carregando lista..." : "Digite ou selecione..."}
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
              {loadingCities && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-indigo-500" />}
            </div>
            <datalist id="step1-cities-list">
              {availableCities.map(city => <option key={city.id} value={city.nome} />)}
            </datalist>
          </div>
        </div>

        {/* Website */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Site / LinkedIn</label>
          <div className="relative">
            <input
              type="text"
              value={data.website || ''}
              onChange={(e) => onUpdate({ ...data, website: e.target.value })}
              className="w-full p-3 pl-10 border border-slate-300 rounded-lg bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="www.exemplo.com.br"
            />
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-6 flex justify-end">
          <button
            onClick={onNext}
            disabled={!isFormValid}
            className={`px-8 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${
              isFormValid ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5' : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            Avançar para Evidências <ArrowRightCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step1Account;
