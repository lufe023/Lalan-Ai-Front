import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Scissors,
  HeartHandshake,
  Footprints,
  ShoppingBag,
  Plus,
  Bot,
  DollarSign,
  Tag,
  Clock,
  Package,
  Layers,
  Edit2,
  Trash2,
  Check,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Eye,
} from 'lucide-react';
import { useApp, ServiceIngredient } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PriceTier, ProductCategory, SalonProduct, SalonService, ServiceCategory } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';
import { PageContent } from '../components/ui/PageContent';

export const CatalogScreen: React.FC = () => {
  const {
    services,
    addService,
    updateService,
    deleteService,
    toggleServiceAi,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductAi,
    showToast,
    loadIngredients,
    saveIngredients,
    catalogDeepLink,
    clearCatalogDeepLink,
  } = useApp();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceApiError, setServiceApiError] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productApiError, setProductApiError] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // ── Ingredient state ──────────────────────────────────────────────────────
  const [serviceModalTab, setServiceModalTab] = useState<'config' | 'recipe'>('config');
  const [ingredients, setIngredients] = useState<ServiceIngredient[]>([]);
  const [ingredientPickerProductId, setIngredientPickerProductId] = useState('');
  const [ingredientQty, setIngredientQty] = useState('1');
  const [ingredientUnit, setIngredientUnit] = useState('unit');
  const [ingredientNotes, setIngredientNotes] = useState('');
  const [isSavingIngredients, setIsSavingIngredients] = useState(false);

  // Form State for Service
  const [serviceForm, setServiceForm] = useState<{
    name: string;
    category: ServiceCategory;
    categoryName: string;
    price: number;
    durationMinutes: number;
    icon: string;
    color: string;
    description: string;
    aiAvailable: boolean;
    priceTiers: PriceTier[];
  }>({
    name: '',
    category: 'nails',
    categoryName: 'Uñas & Manicura',
    price: 35,
    durationMinutes: 60,
    icon: 'Sparkles',
    color: '#e11d48',
    description: '',
    aiAvailable: true,
    priceTiers: [
      { id: 'tier_1', name: 'Precio Estándar / Regular', price: 35, isDefault: true, description: 'Servicio completo estándar' },
    ],
  });

  // Form State for Product
  const [productForm, setProductForm] = useState<{
    name: string;
    category: ProductCategory;
    categoryName: string;
    sku: string;
    basePrice: number;
    stock: number;
    unit: string;
    unitQty: string;
    unitQtyUnit: string;
    image: string;
    description: string;
    aiAvailable: boolean;
    priceTiers: PriceTier[];
    costPrice: string;
    minStock: string;
    alertThreshold: string;
    hasLotTracking: boolean;
    lotStrategy: 'FEFO' | 'FIFO';
  }>({
    name: '',
    category: 'nailcare',
    categoryName: 'Cuidado de Uñas',
    sku: 'PROD-',
    basePrice: 20,
    stock: 15,
    unit: 'unit',
    unitQty: '',
    unitQtyUnit: 'ml',
    image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=150&auto=format&fit=crop&q=80',
    description: '',
    aiAvailable: true,
    priceTiers: [
      { id: 'ptier_1', name: 'Precio Venta Público (PVP)', price: 20, isDefault: true, description: 'Venta individual estándar' },
    ],
    costPrice: '',
    minStock: '',
    alertThreshold: '',
    hasLotTracking: false,
    lotStrategy: 'FEFO',
  });

  // Category names mapping
  const serviceCategoryNames: Record<ServiceCategory, string> = {
    nails: 'Uñas & Manicura',
    hair: 'Peinados & Color',
    massage: 'Masajes & Spa',
    pedi_spa: 'Spa de Pies',
    facial: 'Faciales & Estética',
  };

  const productCategoryNames: Record<ProductCategory, string> = {
    nailcare: 'Cuidado de Uñas',
    haircare: 'Cuidado Capilar',
    skincare: 'Skincare',
    spa_body: 'Spa & Corporal',
    beverage: 'Bebidas',
    snack: 'Aperitivos',
  };

  // Filtered Services
  const filteredServices = services.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Count AI enabled items
  const aiEnabledServicesCount = services.filter(s => s.aiAvailable).length;
  const aiEnabledProductsCount = products.filter(p => p.aiAvailable).length;

  const handleOpenAddService = () => {
    setEditingServiceId(null);
    setServiceForm({
      name: '',
      category: 'nails',
      categoryName: 'Uñas & Manicura',
      price: 35,
      durationMinutes: 60,
      icon: 'Sparkles',
      color: '#e11d48',
      description: '',
      aiAvailable: true,
      priceTiers: [
        { id: `tier_${Date.now()}_1`, name: 'Precio Estándar', price: 35, isDefault: true, description: 'Servicio completo' },
        { id: `tier_${Date.now()}_2`, name: 'Tarifa VIP / Frecuente', price: 30, description: 'Descuento clienta regular' },
      ],
    });
    setServiceModalTab('config');
    setIngredients([]);
    setIngredientPickerProductId('');
    setIngredientQty('1');
    setIngredientUnit('unit');
    setIngredientNotes('');
    setShowServiceModal(true);
  };

  const handleOpenEditService = (service: SalonService) => {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name,
      category: service.category,
      categoryName: service.categoryName,
      price: service.price,
      durationMinutes: service.durationMinutes,
      icon: service.icon,
      color: service.color,
      description: service.description || '',
      aiAvailable: service.aiAvailable,
      priceTiers: (() => {
        const valid = (service.priceTiers ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t));
        return valid.length > 0 ? valid : [{ id: `tier_${Date.now()}`, name: 'Precio Base', price: service.price, isDefault: true }];
      })(),
    });
    setServiceModalTab('config');
    setIngredients([]);
    setIngredientPickerProductId('');
    setIngredientQty('1');
    setIngredientUnit('unit');
    setIngredientNotes('');
    // Load existing ingredients async
    loadIngredients(service.id).then(setIngredients).catch(() => {});
    setShowServiceModal(true);
  };

  const handleOpenAddProduct = () => {
    setEditingProductId(null);
    setProductForm({
      name: '',
      category: 'nailcare',
      categoryName: 'Cuidado de Uñas',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      basePrice: 20,
      stock: 15,
      unit: 'unit',
      unitQty: '',
      unitQtyUnit: 'ml',
      image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=150&auto=format&fit=crop&q=80',
      description: '',
      aiAvailable: true,
      priceTiers: [
        { id: `ptier_${Date.now()}_1`, name: 'Precio Venta al Público (PVP)', price: 20, isDefault: true },
        { id: `ptier_${Date.now()}_2`, name: 'Precio con Cita / Descuento', price: 15, description: 'Comprando en el salón' },
      ],
      costPrice: '',
      minStock: '',
      alertThreshold: '',
      hasLotTracking: false,
      lotStrategy: 'FEFO',
    });
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (product: SalonProduct) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      category: product.category,
      categoryName: product.categoryName,
      sku: product.sku,
      basePrice: product.basePrice,
      stock: product.stock,
      unit: product.unit ?? 'unit',
      unitQty: product.unitQty != null ? String(product.unitQty) : '',
      unitQtyUnit: product.unitQtyUnit ?? 'ml',
      image: product.image || '',
      description: product.description,
      aiAvailable: product.aiAvailable,
      priceTiers: (() => {
        const valid = (product.priceTiers ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t));
        return valid.length > 0 ? valid : [{ id: `ptier_${Date.now()}`, name: 'Precio PVP', price: product.basePrice, isDefault: true }];
      })(),
      costPrice: product.costPrice != null ? String(product.costPrice) : '',
      minStock: product.minStock != null ? String(product.minStock) : '',
      alertThreshold: product.alertThreshold != null ? String(product.alertThreshold) : '',
      hasLotTracking: product.hasLotTracking ?? false,
      lotStrategy: product.lotStrategy ?? 'FEFO',
    });
    setShowProductModal(true);
  };

  // Deep-link desde Dashboard: abrir servicio/producto directo en la pestaña solicitada
  useEffect(() => {
    if (!catalogDeepLink) return;
    if (catalogDeepLink.serviceId) {
      const svc = services.find(s => s.id === catalogDeepLink.serviceId);
      if (svc) {
        handleOpenEditService(svc);
        if (catalogDeepLink.tab === 'recipe') {
          setTimeout(() => setServiceModalTab('recipe'), 50);
        }
      }
    } else if (catalogDeepLink.productId) {
      const prod = products.find(p => p.id === catalogDeepLink.productId);
      if (prod) handleOpenEditProduct(prod);
    }
    clearCatalogDeepLink();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogDeepLink]);

  // Price tier row helpers for Service
  const addServicePriceTier = () => {
    setServiceForm(prev => ({
      ...prev,
      priceTiers: [
        ...prev.priceTiers,
        { id: `tier_${Date.now()}`, name: 'Nueva Variante', price: prev.price, description: '' },
      ],
    }));
  };

  const removeServicePriceTier = (index: number) => {
    if (serviceForm.priceTiers.length <= 1) return;
    setServiceForm(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.filter((_, i) => i !== index),
    }));
  };

  const updateServicePriceTier = (index: number, field: keyof PriceTier, value: any) => {
    setServiceForm(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    }));
  };

  // Price tier row helpers for Product
  const addProductPriceTier = () => {
    setProductForm(prev => ({
      ...prev,
      priceTiers: [
        ...prev.priceTiers,
        { id: `ptier_${Date.now()}`, name: 'Nueva Tarifa', price: prev.basePrice, description: '' },
      ],
    }));
  };

  const removeProductPriceTier = (index: number) => {
    if (productForm.priceTiers.length <= 1) return;
    setProductForm(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.filter((_, i) => i !== index),
    }));
  };

  const updateProductPriceTier = (index: number, field: keyof PriceTier, value: any) => {
    setProductForm(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    }));
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name.trim()) return;
    setServiceApiError('');
    setIsSavingService(true);
    try {
      if (editingServiceId) {
        await updateService(editingServiceId, {
          name: serviceForm.name,
          category: serviceForm.category,
          categoryName: serviceCategoryNames[serviceForm.category],
          price: serviceForm.price,
          durationMinutes: serviceForm.durationMinutes,
          description: serviceForm.description,
          aiAvailable: serviceForm.aiAvailable,
          priceTiers: serviceForm.priceTiers,
        });
        // Save ingredients if on recipe tab or if ingredients were loaded
        if (editingServiceId) {
          setIsSavingIngredients(true);
          try {
            await saveIngredients(editingServiceId, ingredients.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              unit: i.unit,
              notes: i.notes,
            })));
          } catch (_) { /* non-fatal */ } finally {
            setIsSavingIngredients(false);
          }
        }
        showToast('Servicio actualizado', serviceForm.name, 'success');
      } else {
        await addService({
          name: serviceForm.name,
          category: serviceForm.category,
          categoryName: serviceCategoryNames[serviceForm.category],
          price: serviceForm.price,
          durationMinutes: serviceForm.durationMinutes,
          icon: serviceForm.icon,
          color: serviceForm.color,
          description: serviceForm.description,
          aiAvailable: serviceForm.aiAvailable,
          priceTiers: serviceForm.priceTiers,
        });
        showToast('Servicio creado', serviceForm.name, 'success');
      }
      setShowServiceModal(false);
    } catch (err: any) {
      setServiceApiError(err?.message ?? 'Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;
    setProductApiError('');
    setIsSavingProduct(true);
    try {
      const productPayload = {
        name: productForm.name,
        category: productForm.category,
        categoryName: productCategoryNames[productForm.category],
        sku: productForm.sku,
        basePrice: productForm.basePrice,
        stock: productForm.stock,
        unit: productForm.unit,
        unitQty: productForm.unitQty !== '' ? Number(productForm.unitQty) : undefined,
        unitQtyUnit: productForm.unitQty !== '' ? productForm.unitQtyUnit : undefined,
        image: productForm.image,
        description: productForm.description,
        aiAvailable: productForm.aiAvailable,
        priceTiers: productForm.priceTiers,
        costPrice: productForm.costPrice !== '' ? Number(productForm.costPrice) : undefined,
        minStock: productForm.minStock !== '' ? Number(productForm.minStock) : undefined,
        alertThreshold: productForm.alertThreshold !== '' ? Number(productForm.alertThreshold) : undefined,
        hasLotTracking: productForm.hasLotTracking,
        lotStrategy: productForm.lotStrategy,
      };
      if (editingProductId) {
        await updateProduct(editingProductId, productPayload);
        showToast('Producto actualizado', productForm.name, 'success');
      } else {
        await addProduct(productPayload);
        showToast('Producto creado', productForm.name, 'success');
      }
      setShowProductModal(false);
    } catch (err: any) {
      setProductApiError(err?.message ?? 'Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const getServiceCategoryIcon = (category: ServiceCategory) => {
    switch (category) {
      case 'nails':
        return <Sparkles className="w-4 h-4 text-rose-500" />;
      case 'hair':
        return <Scissors className="w-4 h-4 text-purple-500" />;
      case 'massage':
        return <HeartHandshake className="w-4 h-4 text-emerald-500" />;
      case 'pedi_spa':
        return <Footprints className="w-4 h-4 text-sky-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div id="catalog-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Catálogo"
        subtitle={
          activeTab === 'services'
            ? `${services.length} servicios disponibles`
            : `${products.length} productos registrados`
        }
        rightAction={
          <button
            onClick={activeTab === 'services' ? handleOpenAddService : handleOpenAddProduct}
            className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm ios-touch cursor-pointer hover:opacity-90 transition"
            title={activeTab === 'services' ? 'Nuevo Servicio' : 'Nuevo Producto'}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        }
      />

      <PageContent className="space-y-3.5">
        {/* Main Segmented Control: Servicios vs Productos */}
        <IOSSegmentedControl
          id="catalog-tab-selector"
          options={[
            { id: 'services', label: '💅 Servicios & Tarifas' },
            { id: 'products', label: '🛍️ Productos & Stock' },
          ]}
          value={activeTab}
          onChange={val => {
            setActiveTab(val as any);
            setSelectedCategory('all');
          }}
        />

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'services'
                ? 'Buscar servicio por nombre o técnica...'
                : 'Buscar producto por nombre, SKU o marca...'
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
          {activeTab === 'services'
            ? [
                { id: 'all', label: 'Todos los Servicios' },
                { id: 'nails', label: '💅 Uñas & Manicura' },
                { id: 'hair', label: '💇‍♀️ Peinados & Color' },
                { id: 'massage', label: '💆‍♀️ Masajes & Spa' },
                { id: 'pedi_spa', label: '🦶 Spa de Pies' },
              ].map(c => {
                const isSelected = selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ios-touch cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
                        : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-300 border border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })
            : [
                { id: 'all', label: 'Todos los Productos' },
                { id: 'haircare', label: '🧴 Capilar & Olaplex' },
                { id: 'nailcare', label: '💅 Cuidado de Uñas' },
                { id: 'spa_body', label: '🌿 Spa & Corporal' },
                { id: 'skincare', label: '✨ Skincare Facial' },
                { id: 'beverage', label: '☕ Bebidas' },
                { id: 'snack', label: '🍪 Aperitivos' },
              ].map(c => {
                const isSelected = selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ios-touch cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
                        : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-300 border border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
        </div>

        {/* Informative AI Bot Sync Banner */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-rose-500/10 border border-purple-500/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-[11px]">
                Sincronización con Bot IA Meta
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                Los servicios y productos con el interruptor 🤖 activo son ofrecidos con sus variantes de precio en WhatsApp, IG y Messenger.
              </p>
            </div>
          </div>
        </div>

        {/* SERVICES LIST */}
        {activeTab === 'services' && (
          <div className="space-y-3">
            {filteredServices.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
                <Sparkles className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No hay servicios registrados
                </h4>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">
                  Crea tu primer servicio con su tabla de precios multinivel.
                </p>
                <button
                  onClick={handleOpenAddService}
                  className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold ios-touch cursor-pointer"
                >
                  + Agregar Servicio
                </button>
              </div>
            ) : (
              filteredServices.map(service => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3"
                >
                  {/* Service Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                        style={{
                          backgroundColor: `${service.color || '#e11d48'}20`,
                          color: service.color || '#e11d48',
                        }}
                      >
                        {getServiceCategoryIcon(service.category)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {service.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-semibold text-slate-600 dark:text-neutral-400">
                            {service.categoryName}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {service.durationMinutes} min
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditService(service)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] ios-touch cursor-pointer"
                        title="Editar Servicio y Tabla de Precios"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar "${service.name}" del catálogo?`)) {
                            deleteService(service.id);
                          }
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-400 hover:text-rose-500 ios-touch cursor-pointer"
                        title="Eliminar Servicio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {service.description && (
                    <p className="text-[11px] text-slate-600 dark:text-neutral-400 leading-relaxed">
                      {service.description}
                    </p>
                  )}

                  {/* PRICE TABLE / TABLA DE PRECIOS */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 px-1">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-[var(--primary)]" />
                        Tabla de Precios & Opciones ({service.priceTiers?.length || 1})
                      </span>
                      <span>Tarifa</span>
                    </div>

                    <div className="space-y-1">
                      {((() => { const v = (service.priceTiers ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t)); return v.length > 0 ? v : [{ id: '1', name: 'Precio Base', price: service.price, isDefault: true }]; })()).map(tier => (
                        <div
                          key={tier.id}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200/50 dark:border-neutral-800 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-[11px] block truncate">
                              {tier.name}
                              {tier.isDefault && (
                                <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300">
                                  Base
                                </span>
                              )}
                            </span>
                            {tier.description && (
                              <span className="text-[9px] text-slate-400 block truncate">
                                {tier.description}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-slate-900 dark:text-white text-xs shrink-0">
                            ${tier.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Availability Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-neutral-800/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Bot
                        className={`w-4 h-4 ${
                          service.aiAvailable ? 'text-purple-500' : 'text-slate-400'
                        }`}
                      />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300">
                        {service.aiAvailable ? 'Bot IA ofrece este servicio' : 'Pausado en Bot IA'}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleServiceAi(service.id, !service.aiAvailable)}
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition ios-touch cursor-pointer ${
                        service.aiAvailable
                          ? 'bg-purple-500 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                      }`}
                    >
                      {service.aiAvailable ? '✓ Activo' : 'Inactivo'}
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* PRODUCTS LIST */}
        {activeTab === 'products' && (
          <div className="space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
                <Package className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No hay productos registrados
                </h4>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">
                  Agrega productos de venta con sus precios minoristas y mayoristas.
                </p>
                <button
                  onClick={handleOpenAddProduct}
                  className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold ios-touch cursor-pointer"
                >
                  + Agregar Producto
                </button>
              </div>
            ) : (
              filteredProducts.map(product => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3"
                >
                  {/* Product Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          product.image ||
                          'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=150&auto=format&fit=crop&q=80'
                        }
                        alt={product.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {product.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-semibold text-slate-600 dark:text-neutral-400">
                            {product.categoryName}
                          </span>
                          <span>•</span>
                          <span className={`font-medium ${
                            product.minStock != null && product.stock <= product.minStock
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            Stock: {product.stock} {product.unit ?? 'unid.'}
                            {product.unit === 'unit' && product.unitQty != null && (
                              <span className="text-slate-400 dark:text-neutral-500 ml-1">· {product.unitQty} {product.unitQtyUnit ?? 'ml'} c/u</span>
                            )}
                            {product.minStock != null && product.stock <= product.minStock && (
                              <span className="ml-1 text-amber-500">⚠️</span>
                            )}
                          </span>
                          <span>•</span>
                          <span className="text-[9px] text-slate-400">SKU: {product.sku}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditProduct(product)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] ios-touch cursor-pointer"
                        title="Editar Producto y Tabla de Precios"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar "${product.name}" del catálogo?`)) {
                            deleteProduct(product.id);
                          }
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-400 hover:text-rose-500 ios-touch cursor-pointer"
                        title="Eliminar Producto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {product.description && (
                    <p className="text-[11px] text-slate-600 dark:text-neutral-400 leading-relaxed">
                      {product.description}
                    </p>
                  )}

                  {/* PRODUCT PRICE TABLE / TABLA DE PRECIOS */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 px-1">
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3 text-[var(--primary)]" />
                        Tabla de Precios de Venta ({product.priceTiers?.length || 1})
                      </span>
                      <div className="flex items-center gap-2">
                        {product.costPrice != null && product.basePrice > 0 && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                            ((product.basePrice - product.costPrice) / product.basePrice) >= 0.35
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                              : ((product.basePrice - product.costPrice) / product.basePrice) >= 0.15
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                              : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                          }`}>
                            {Math.round(((product.basePrice - product.costPrice) / product.basePrice) * 100)}% margen
                          </span>
                        )}
                        <span>Precio</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {((() => { const v = (product.priceTiers ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t)); return v.length > 0 ? v : [{ id: '1', name: 'Precio PVP', price: product.basePrice, isDefault: true }]; })()).map(tier => (
                        <div
                          key={tier.id}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200/50 dark:border-neutral-800 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-[11px] block truncate">
                              {tier.name}
                              {tier.isDefault && (
                                <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300">
                                  PVP
                                </span>
                              )}
                            </span>
                            {tier.description && (
                              <span className="text-[9px] text-slate-400 block truncate">
                                {tier.description}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                            ${tier.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendation Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-neutral-800/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Bot
                        className={`w-4 h-4 ${
                          product.aiAvailable ? 'text-purple-500' : 'text-slate-400'
                        }`}
                      />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300">
                        {product.aiAvailable ? 'Bot IA recomienda este producto' : 'Pausado en Bot IA'}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleProductAi(product.id, !product.aiAvailable)}
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition ios-touch cursor-pointer ${
                        product.aiAvailable
                          ? 'bg-purple-500 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                      }`}
                    >
                      {product.aiAvailable ? '✓ Activo' : 'Inactivo'}
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </PageContent>

      {/* SERVICE MODAL (Add / Edit + Dynamic Price Table) */}
      <IOSModal
        isOpen={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        title={editingServiceId ? 'Editar Servicio' : 'Nuevo Servicio de Belleza'}
        subtitle="Configuración y Tabla de Precios Multinivel"
      >
        <form onSubmit={handleSaveService} className="space-y-0 text-xs select-none">
          {/* Tab switcher — only show when editing */}
          {editingServiceId && (
            <div className="mb-4">
              <IOSSegmentedControl
                id="service-modal-tabs"
                options={[
                  { id: 'config', label: '⚙️ Configuración' },
                  { id: 'recipe', label: '🧪 Receta / Consumibles' },
                ]}
                value={serviceModalTab}
                onChange={(val) => setServiceModalTab(val as 'config' | 'recipe')}
              />
            </div>
          )}

          {/* ── RECIPE TAB ─────────────────────────────────────────────── */}
          {editingServiceId && serviceModalTab === 'recipe' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                Define qué productos usa este servicio y cuánto se gasta de cada uno. El sistema descuenta el stock automáticamente al completar una cita.
              </div>

              {ingredients.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-slate-200 dark:border-neutral-700">
                  <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-neutral-600" />
                  <p>Sin ingredientes — agrega productos abajo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div key={ing.productId} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 shadow-xs">
                      <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                          {ing.product?.name ?? ing.productId}
                        </p>
                        {ing.notes && (
                          <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{ing.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={ing.quantity}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setIngredients(prev => prev.map((i, j) => j === idx ? { ...i, quantity: val } : i));
                          }}
                          className="w-16 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-center font-bold focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />
                        <span className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[10px] font-bold text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700 min-w-[32px] text-center">
                          {ing.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIngredients(prev => prev.filter((_, j) => j !== idx))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new ingredient */}
              <div className="p-3.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 space-y-3">
                <p className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wide">+ Agregar producto consumible</p>
                <select
                  value={ingredientPickerProductId}
                  onChange={e => {
                    setIngredientPickerProductId(e.target.value);
                    const picked = products.find(p => p.id === e.target.value);
                    if (picked) {
                      const recipeUnit = (picked.unit === 'unit' && picked.unitQtyUnit) ? picked.unitQtyUnit : picked.unit ?? 'unit';
                      setIngredientUnit(recipeUnit);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">— Seleccionar producto —</option>
                  {products.filter(p => !ingredients.find(i => i.productId === p.id)).map(p => {
                    const availLabel = (p.unit === 'unit' && p.unitQty != null)
                      ? `${p.stock} unid. × ${p.unitQty}${p.unitQtyUnit ?? 'ml'} = ${+(p.stock * p.unitQty).toFixed(2)}${p.unitQtyUnit ?? 'ml'} disponibles`
                      : `stock: ${p.stock} ${p.unit}`;
                    return <option key={p.id} value={p.id}>{p.name} · {availLabel}</option>;
                  })}
                </select>
                {(() => {
                  const picked = products.find(p => p.id === ingredientPickerProductId);
                  if (picked && picked.unit === 'unit' && picked.unitQty != null) {
                    const total = +(picked.stock * picked.unitQty).toFixed(2);
                    return (
                      <p className="text-[10px] text-slate-500 dark:text-neutral-400 -mt-1.5 px-1">
                        Disponible: {picked.stock} unid. × {picked.unitQty} {picked.unitQtyUnit ?? 'ml'} = <strong className="text-slate-700 dark:text-neutral-300">{total} {picked.unitQtyUnit ?? 'ml'}</strong>
                      </p>
                    );
                  }
                  return null;
                })()}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 dark:text-neutral-400 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="Cantidad"
                      value={ingredientQty}
                      onChange={e => setIngredientQty(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div className="w-20 text-center">
                    <label className="block text-[10px] text-slate-500 dark:text-neutral-400 mb-1">Unidad</label>
                    <div className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-700 dark:text-neutral-300 font-bold">
                      {ingredientUnit}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-neutral-400 mb-1">Nota opcional</label>
                  <input
                    type="text"
                    placeholder="ej: esmalte base, top coat"
                    value={ingredientNotes}
                    onChange={e => setIngredientNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <button
                  type="button"
                  disabled={!ingredientPickerProductId}
                  onClick={() => {
                    if (!ingredientPickerProductId) return;
                    const prod = products.find(p => p.id === ingredientPickerProductId);
                    setIngredients(prev => [...prev, {
                      id: `local_${Date.now()}`,
                      productId: ingredientPickerProductId,
                      quantity: parseFloat(ingredientQty) || 1,
                      unit: ingredientUnit,
                      notes: ingredientNotes || undefined,
                      product: prod ? { id: prod.id, name: prod.name, category: prod.category, categoryName: prod.categoryName, sku: prod.sku, stock: prod.stock } : undefined,
                    }]);
                    setIngredientPickerProductId('');
                    setIngredientQty('1');
                    setIngredientNotes('');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold disabled:opacity-40 ios-touch cursor-pointer transition"
                >
                  Agregar al servicio
                </button>
              </div>

              {/* Save button */}
              <button
                type="button"
                disabled={isSavingIngredients}
                onClick={async () => {
                  if (!editingServiceId) return;
                  setIsSavingIngredients(true);
                  try {
                    const saved = await saveIngredients(editingServiceId, ingredients.map(i => ({
                      productId: i.productId,
                      quantity: i.quantity,
                      unit: i.unit,
                      notes: i.notes,
                    })));
                    setIngredients(saved);
                    showToast('Receta guardada', 'Ingredientes actualizados', 'success');
                  } catch (e: any) {
                    showToast('Error al guardar', e?.message ?? 'Intenta de nuevo', 'warning');
                  } finally {
                    setIsSavingIngredients(false);
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-md ios-touch cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {isSavingIngredients ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Guardando receta…
                  </>
                ) : '✓ Guardar Receta'}
              </button>
            </div>
          )}

          {/* ── CONFIG TAB (default) ──────────────────────────────────── */}
          <div className={editingServiceId && serviceModalTab === 'recipe' ? 'hidden' : 'space-y-5'}>

            {/* SECTION: Información del Servicio */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-slate-800 dark:text-white">Información del Servicio</span>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Kapping Gel con Nivelación Rusa"
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-semibold text-[13px] placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:bg-white dark:focus:bg-neutral-900 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                  Categoría
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'nails', label: 'Uñas & Manicura', emoji: '💅' },
                    { id: 'hair', label: 'Peinados & Color', emoji: '💇‍♀️' },
                    { id: 'massage', label: 'Masajes & Spa', emoji: '💆‍♀️' },
                    { id: 'pedi_spa', label: 'Spa de Pies', emoji: '🦶' },
                    { id: 'facial', label: 'Faciales', emoji: '✨' },
                  ] as const).map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setServiceForm({ ...serviceForm, category: cat.id, categoryName: serviceCategoryNames[cat.id] })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition ios-touch cursor-pointer ${
                        serviceForm.category === cat.id
                          ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)] font-bold'
                          : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="text-base shrink-0">{cat.emoji}</span>
                      <span className="text-[11px] leading-tight flex-1">{cat.label}</span>
                      {serviceForm.category === cat.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                  Duración estimada
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setServiceForm(prev => ({ ...prev, durationMinutes: Math.max(15, prev.durationMinutes - 5) }))}
                    className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 font-bold text-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 transition ios-touch cursor-pointer shrink-0"
                  >−</button>
                  <div className="flex-1 text-center py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
                    <span className="text-xl font-black text-slate-900 dark:text-white">{serviceForm.durationMinutes}</span>
                    <span className="text-[11px] text-slate-500 dark:text-neutral-400 ml-1.5">minutos</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServiceForm(prev => ({ ...prev, durationMinutes: prev.durationMinutes + 5 }))}
                    className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 font-bold text-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 transition ios-touch cursor-pointer shrink-0"
                  >+</button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                  Descripción <span className="normal-case font-normal opacity-60 text-[10px]">(el Bot IA la usa para explicar el servicio)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalla qué incluye el servicio para que el Bot IA lo explique a las clientas..."
                  value={serviceForm.description}
                  onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:bg-white dark:focus:bg-neutral-900 transition resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* SECTION: Tabla de Precios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-slate-800 dark:text-white">Tabla de Precios</span>
                </div>
                <button
                  type="button"
                  onClick={addServicePriceTier}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer ios-touch"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Variante</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                Agrega variantes de precio: VIP, retoque, promoción, etc.
              </p>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {serviceForm.priceTiers.map((tier, index) => (
                  <div
                    key={tier.id}
                    className={`p-3 rounded-xl border space-y-2 ${
                      index === 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700/80'
                    }`}
                  >
                    {index === 0 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Precio Base (requerido)
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={index === 0 ? 'Ej: Precio Estándar' : 'Ej: VIP, Retoque, Promo'}
                        value={tier.name}
                        onChange={e => updateServicePriceTier(index, 'name', e.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      />
                      <div className="flex items-center gap-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 w-24">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input
                          type="number"
                          min="0"
                          value={tier.price}
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateServicePriceTier(index, 'price', val);
                            if (index === 0) setServiceForm(prev => ({ ...prev, price: val }));
                          }}
                          className="w-full bg-transparent text-[12px] font-black text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                      {serviceForm.priceTiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeServicePriceTier(index)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Detalle opcional: ej. hasta 21 días de duración"
                      value={tier.description || ''}
                      onChange={e => updateServicePriceTier(index, 'description', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700/60 text-[10px] text-slate-500 dark:text-neutral-400 placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION: Ícono */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm leading-none">
                  {serviceForm.icon || '✨'}
                </div>
                <span className="font-bold text-xs text-slate-800 dark:text-white">Ícono del Servicio</span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {['💅','💇‍♀️','💆‍♀️','🦶','✨','💎','🌸','🪷','🌺','🧖‍♀️','💄','👄','💋','🌹','🍃','🌿','🪻','🧴','🪨','🕯️','🛁','🧼','💫','⭐','🌟','🎀','🎁','🌙','☀️','🦋'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setServiceForm(prev => ({ ...prev, icon: emoji }))}
                    className={`h-9 w-full rounded-lg text-base flex items-center justify-center transition ios-touch cursor-pointer ${
                      serviceForm.icon === emoji
                        ? 'bg-[var(--primary)]/20 ring-2 ring-[var(--primary)]'
                        : 'hover:bg-slate-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION: Bot IA */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/8 dark:bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-[12px] text-slate-900 dark:text-white block">
                    Ofrecer con Bot IA
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                    El bot lo ofrece en WhatsApp, IG y Messenger
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setServiceForm(prev => ({ ...prev, aiAvailable: !prev.aiAvailable }))}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${
                  serviceForm.aiAvailable ? 'bg-purple-500' : 'bg-slate-300 dark:bg-neutral-700'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  serviceForm.aiAvailable ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>

            {serviceApiError && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 text-[11px] font-medium">
                <span className="mt-0.5 shrink-0">⚠️</span>
                <span>{serviceApiError}</span>
              </div>
            )}

          </div>{/* end config tab */}

          <button
            type="submit"
            disabled={isSavingService}
            className={`w-full py-3.5 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-md ios-touch cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition mt-5 ${editingServiceId && serviceModalTab === 'recipe' ? 'hidden' : ''}`}
          >
            {isSavingService ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {editingServiceId ? 'Guardando…' : 'Creando…'}
              </>
            ) : (
              editingServiceId ? '✓ Guardar Cambios del Servicio' : '✨ Crear Servicio en Catálogo'
            )}
          </button>
        </form>

      </IOSModal>

      {/* PRODUCT MODAL (Add / Edit + Dynamic Price Table) */}
      <IOSModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={editingProductId ? 'Editar Producto' : 'Nuevo Producto en Boutique'}
        subtitle="Inventario y Precios de Venta"
      >
        <form onSubmit={handleSaveProduct} className="space-y-0 text-xs select-none">

          {/* SECTION: Información básica */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-neutral-800">
              <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-white">Información del Producto</span>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                Nombre *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Olaplex Nº 4 Bond Maintenance Shampoo"
                value={productForm.name}
                onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-semibold text-[13px] placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:bg-white dark:focus:bg-neutral-900 transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                Categoría
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'nailcare', label: 'Cuidado de Uñas', emoji: '💅' },
                  { id: 'haircare', label: 'Cuidado Capilar', emoji: '🧴' },
                  { id: 'spa_body', label: 'Spa & Corporal', emoji: '🌿' },
                  { id: 'skincare', label: 'Skincare', emoji: '✨' },
                  { id: 'beverage', label: 'Bebidas', emoji: '☕' },
                  { id: 'snack', label: 'Aperitivos', emoji: '🍪' },
                ] as const).map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setProductForm({ ...productForm, category: cat.id, categoryName: productCategoryNames[cat.id] })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition ios-touch cursor-pointer ${
                      productForm.category === cat.id
                        ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)] font-bold'
                        : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="text-base shrink-0">{cat.emoji}</span>
                    <span className="text-[11px] leading-tight flex-1">{cat.label}</span>
                    {productForm.category === cat.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                Descripción <span className="normal-case font-normal opacity-60 text-[10px]">(el bot la usa para recomendar)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Descripción que el bot utilizará para responder a clientas interesadas..."
                value={productForm.description}
                onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:bg-white dark:focus:bg-neutral-900 transition resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* SECTION: Stock & Medidas */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-neutral-800">
              <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-white">Stock & Medidas</span>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                Cantidad en stock
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="0"
                  value={productForm.stock}
                  onChange={e => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                  className="flex-1 px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-bold text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:bg-white dark:focus:bg-neutral-900 transition"
                />
                <select
                  value={productForm.unit}
                  onChange={e => setProductForm({ ...productForm, unit: e.target.value })}
                  className="px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-xs"
                >
                  <option value="unit">unidades</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="oz">oz</option>
                  <option value="cl">cl</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1.5 px-1">
                Ej: 100 ml, 5 unidades, 200 g
              </p>
            </div>

            {productForm.unit === 'unit' && (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/40 space-y-2.5">
                <p className="text-[11px] font-bold text-sky-700 dark:text-sky-400">📦 ¿Cuánto contiene cada unidad?</p>
                <p className="text-[10px] text-slate-500 dark:text-neutral-400 leading-relaxed">Si cada botella tiene 15 ml, escríbelo aquí para que el sistema calcule bien cuánto se usa en las recetas de tus servicios.</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="ej: 15"
                    value={productForm.unitQty}
                    onChange={e => setProductForm({ ...productForm, unitQty: e.target.value })}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                  />
                  <select
                    value={productForm.unitQtyUnit}
                    onChange={e => setProductForm({ ...productForm, unitQtyUnit: e.target.value })}
                    className="px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 text-xs font-semibold transition"
                  >
                    <option value="ml">ml</option>
                    <option value="cl">cl</option>
                    <option value="L">L</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="oz">oz</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: Precios de Venta */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-slate-800 dark:text-white">Precios de Venta</span>
              </div>
              <button
                type="button"
                onClick={addProductPriceTier}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer ios-touch"
              >
                <Plus className="w-3 h-3" />
                <span>+ Tarifa</span>
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {productForm.priceTiers.map((tier, index) => (
                <div
                  key={tier.id}
                  className={`p-3 rounded-xl border space-y-2 ${
                    index === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                      : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700/80'
                  }`}
                >
                  {index === 0 && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Precio PVP (requerido)
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={index === 0 ? 'Ej: Precio al Público' : 'Ej: Descuento post-cita, Mayorista'}
                      value={tier.name}
                      onChange={e => updateProductPriceTier(index, 'name', e.target.value)}
                      className="flex-1 px-2.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                    <div className="flex items-center gap-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 w-24">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="number"
                        min="0"
                        value={tier.price}
                        onChange={e => {
                          const val = Number(e.target.value);
                          updateProductPriceTier(index, 'price', val);
                          if (index === 0) setProductForm(prev => ({ ...prev, basePrice: val }));
                        }}
                        className="w-full bg-transparent text-[12px] font-black text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    {productForm.priceTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProductPriceTier(index)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Condición o detalle opcional"
                    value={tier.description || ''}
                    onChange={e => updateProductPriceTier(index, 'description', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700/60 text-[10px] text-slate-500 dark:text-neutral-400 placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SECTION: Costo & Rentabilidad */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-neutral-800">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-white">Costo & Rentabilidad</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-neutral-400 leading-relaxed">
              ¿Cuánto te costó comprar este producto? Con ese dato calculamos automáticamente tu ganancia real por servicio y por venta.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                  Costo de compra
                </label>
                <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-800/50 focus-within:ring-2 focus-within:ring-amber-400 transition">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={productForm.costPrice}
                    onChange={e => setProductForm({ ...productForm, costPrice: e.target.value })}
                    className="flex-1 bg-transparent text-[13px] font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                {productForm.costPrice !== '' && productForm.basePrice > 0 && Number(productForm.costPrice) > 0 && (() => {
                  const margin = Math.round(((productForm.basePrice - Number(productForm.costPrice)) / productForm.basePrice) * 100);
                  const isGood = margin >= 35;
                  const isOk = margin >= 15;
                  return (
                    <p className={`text-[10px] mt-1.5 px-0.5 font-bold ${isGood ? 'text-emerald-600 dark:text-emerald-400' : isOk ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isGood ? '✓' : isOk ? '⚠' : '↓'} Ganancia: {margin}% {isGood ? '(Excelente)' : isOk ? '(Ajustado)' : '(Bajo)'}
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                  Stock mínimo (alerta)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="ej: 5"
                  value={productForm.minStock}
                  onChange={e => setProductForm({ ...productForm, minStock: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[13px] font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                />
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1.5 px-0.5 leading-relaxed">
                  Te avisamos cuando quede menos de este número
                </p>
              </div>
            </div>

            {/* Lot tracking toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700">
              <div className="pr-4">
                <span className="text-[12px] font-bold text-slate-800 dark:text-white block">
                  Control por Lotes
                </span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                  Registra fechas de vencimiento para desechar primero lo que vence antes
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProductForm(prev => ({ ...prev, hasLotTracking: !prev.hasLotTracking }))}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${
                  productForm.hasLotTracking ? 'bg-amber-500' : 'bg-slate-300 dark:bg-neutral-700'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  productForm.hasLotTracking ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>

            {productForm.hasLotTracking && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                  Orden de salida de lotes
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProductForm(prev => ({ ...prev, lotStrategy: 'FEFO' }))}
                    className={`p-3 rounded-xl border text-left transition ios-touch cursor-pointer ${
                      productForm.lotStrategy === 'FEFO'
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className={`block text-[11px] font-bold mb-0.5 ${productForm.lotStrategy === 'FEFO' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>Primero el que vence antes</span>
                    <span className="block text-[9px] text-slate-500 dark:text-neutral-400">Recomendado para cosméticos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductForm(prev => ({ ...prev, lotStrategy: 'FIFO' }))}
                    className={`p-3 rounded-xl border text-left transition ios-touch cursor-pointer ${
                      productForm.lotStrategy === 'FIFO'
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className={`block text-[11px] font-bold mb-0.5 ${productForm.lotStrategy === 'FIFO' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>Primero el que entró antes</span>
                    <span className="block text-[9px] text-slate-500 dark:text-neutral-400">Por orden de compra</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: Bot IA */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/8 dark:bg-purple-500/10 border border-purple-500/20 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[12px] text-slate-900 dark:text-white block">
                  Recomendar con Bot IA
                </span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                  El bot lo sugiere cuando clientas preguntan por cuidados
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProductForm(prev => ({ ...prev, aiAvailable: !prev.aiAvailable }))}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${
                productForm.aiAvailable ? 'bg-purple-500' : 'bg-slate-300 dark:bg-neutral-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                productForm.aiAvailable ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>

          {productApiError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 text-[11px] font-medium mb-4">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span>{productApiError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingProduct}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-md ios-touch cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isSavingProduct ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {editingProductId ? 'Guardando…' : 'Creando…'}
              </>
            ) : (
              editingProductId ? '✓ Guardar Cambios del Producto' : '🛍️ Guardar Producto en Catálogo'
            )}
          </button>
        </form>
     
      </IOSModal>
    </div>
  );
};
