import React, { useState } from 'react';
import { AppState, genId } from '../store';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function Shop({ state, setState }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCost, setNewItemCost] = useState(10);
  const [newItemTier, setNewItemTier] = useState<'cheap' | 'expensive'>('cheap');

  const purchaseItem = (itemId: string) => {
    const item = state.shop_items.find(i => i.id === itemId);
    if (!item) return;
    if ((state.gold || 0) < item.cost) {
      alert('Недостаточно золота!');
      return;
    }
    if (!confirm(`Потратить ${item.cost} 🪙 на "${item.name}"?`)) return;

    setState(prev => ({
      ...prev,
      gold: (prev.gold || 0) - item.cost,
      shop_items: prev.shop_items.map(i =>
        i.id === itemId ? { ...i, purchased_count: i.purchased_count + 1 } : i
      ),
    }));
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    setState(prev => ({
      ...prev,
      shop_items: [
        ...prev.shop_items,
        {
          id: genId(),
          name: newItemName.trim(),
          description: newItemDesc.trim(),
          cost: newItemCost,
          tier: newItemTier,
          purchased_count: 0,
        },
      ],
    }));
    setNewItemName('');
    setNewItemDesc('');
    setNewItemCost(10);
    setShowAddForm(false);
  };

  const deleteItem = (itemId: string) => {
    if (!confirm('Удалить этот предмет?')) return;
    setState(prev => ({
      ...prev,
      shop_items: prev.shop_items.filter(i => i.id !== itemId),
    }));
  };

  const cheapItems = state.shop_items.filter(i => i.tier === 'cheap');
  const expensiveItems = state.shop_items.filter(i => i.tier === 'expensive');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Gold Balance */}
      <div className="glass-panel p-5 text-center">
        <div className="text-4xl font-bold text-[var(--warn)]">
          🪙 {state.gold || 0}
        </div>
        <div className="text-sm text-[var(--text-dim)] mt-2">
          Золото зарабатывается записью действий (1 🪙 за каждые 5 XP)
        </div>
      </div>

      {/* Add Item Button */}
      <div className="glass-panel p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">🛒 Магазин желаний</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
          >
            {showAddForm ? 'Отмена' : '+ Добавить'}
          </button>
        </div>

        {showAddForm && (
          <div className="space-y-3 animate-slide-up">
            <input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="Название (например: 'Пицца')"
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
            <input
              type="text"
              value={newItemDesc}
              onChange={e => setNewItemDesc(e.target.value)}
              placeholder="Описание (необязательно)"
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={newItemCost}
                onChange={e => setNewItemCost(parseInt(e.target.value) || 0)}
                min="1"
                className="flex-1 bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              <select
                value={newItemTier}
                onChange={e => setNewItemTier(e.target.value as 'cheap' | 'expensive')}
                className="bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="cheap">Маленькая радость</option>
                <option value="expensive">Большая хотелка</option>
              </select>
            </div>
            <button
              onClick={addItem}
              disabled={!newItemName.trim()}
              className="w-full bg-[var(--accent)] text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50"
            >
              Добавить в магазин
            </button>
          </div>
        )}
      </div>

      {/* Cheap Items */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
          Маленькие радости (10-20 🪙)
        </h3>
        {cheapItems.length === 0 ? (
          <div className="glass-panel p-4 text-center">
            <p className="text-sm text-[var(--text-dim)]">Пока пусто</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cheapItems.map(item => (
              <div key={item.id} className="glass-panel p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-[var(--text-dim)] mt-1">{item.description}</div>
                  )}
                  {item.purchased_count > 0 && (
                    <div className="text-xs text-[var(--good)] mt-1">
                      Куплено: {item.purchased_count}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--warn)]">🪙 {item.cost}</span>
                  <button
                    onClick={() => purchaseItem(item.id)}
                    disabled={(state.gold || 0) < item.cost}
                    className="bg-[var(--good)] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    Купить
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-[var(--text-dim)] hover:text-[var(--danger)] text-lg"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expensive Items */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
          Большие хотелки (100+ 🪙)
        </h3>
        {expensiveItems.length === 0 ? (
          <div className="glass-panel p-4 text-center">
            <p className="text-sm text-[var(--text-dim)]">Пока пусто</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expensiveItems.map(item => (
              <div key={item.id} className="glass-panel p-4 flex items-center gap-3 border-l-3" style={{ borderLeftColor: 'var(--warn)' }}>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-[var(--text-dim)] mt-1">{item.description}</div>
                  )}
                  {item.purchased_count > 0 && (
                    <div className="text-xs text-[var(--good)] mt-1">
                      Куплено: {item.purchased_count}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--warn)]">🪙 {item.cost}</span>
                  <button
                    onClick={() => purchaseItem(item.id)}
                    disabled={(state.gold || 0) < item.cost}
                    className="bg-[var(--good)] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    Купить
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-[var(--text-dim)] hover:text-[var(--danger)] text-lg"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="glass-panel p-4 bg-[var(--panel-2)]">
        <h4 className="text-sm font-semibold mb-2">💡 Как это работает</h4>
        <ul className="text-xs text-[var(--text-dim)] space-y-1 list-disc list-inside">
          <li>За каждое действие ты получаешь XP (для роста) и золото (для магазина)</li>
          <li>Маленькие радости — быстрые удовольствия, которые можно позволить часто</li>
          <li>Большие хотелки — требуют накопления, но дают больше удовлетворения</li>
          <li>Покупай только когда реально хочешь — это награда за дисциплину</li>
        </ul>
      </div>
    </div>
  );
}
