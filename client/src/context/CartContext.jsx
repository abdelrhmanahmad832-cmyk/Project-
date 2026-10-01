import { createContext, useContext, useEffect, useState } from 'react';

const CART_KEY = 'souq_cart';
const CartContext = createContext(null);

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const add = (product, quantity = 1) =>
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) } : i
        );
      }
      const { id, name, price, image_url, stock } = product;
      return [...prev, { id, name, price, image_url, stock, quantity: Math.min(quantity, stock) }];
    });

  const update = (id, quantity) =>
    setItems((prev) =>
      quantity <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );

  // Refresh prices/stock from the server; drops products that no longer exist.
  const sync = (products) =>
    setItems((prev) =>
      prev.flatMap((i) => {
        const p = products.find((x) => x.id === i.id);
        if (!p || p.stock <= 0) return [];
        return [{ ...i, name: p.name, price: p.price, image_url: p.image_url, stock: p.stock, quantity: Math.min(i.quantity, p.stock) }];
      })
    );

  const value = {
    items,
    sync,
    add,
    update,
    remove: (id) => update(id, 0),
    clear: () => setItems([]),
    count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.price * i.quantity, 0),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
