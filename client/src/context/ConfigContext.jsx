import { createContext, useContext, useEffect, useState } from 'react';
import { api, setCurrency } from '../api.js';

const DEFAULTS = { storeName: 'سوق', currency: 'EGP', shippingFee: 0, freeShippingMin: 0, cardPayments: false };
const ConfigContext = createContext(DEFAULTS);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS);
  useEffect(() => {
    api('/config')
      .then((c) => {
        setCurrency(c.currency);
        setConfig(c);
        document.title = `${c.storeName} — متجرك الإلكتروني`;
      })
      .catch(() => {});
  }, []);
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
