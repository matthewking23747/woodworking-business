import React, { useState, useEffect } from 'react';
import { Trash2, Plus, FileText } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function WoodworkingBusiness() {
    const [activeTab, setActiveTab] = useState('quotes');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [formData, setFormData] = useState({
        customerName: '',
        product: '',
        sentQuote: false,
        quoteApproved: false,
        quotePdf: null,
        quotePdfName: '',
        materials: [],
        deliveryAddress: '',
        deliveryDate: '',
        progress: 'pending'
    });

    const [materialInput, setMaterialInput] = useState({
        item: '',
        quantity: '',
        cost: ''
    });

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;

            const transformedOrders = data.map(order => ({
                id: order.id,
                customerName: order.customer_name,
                product: order.product,
                sentQuote: order.sent_quote,
                quoteApproved: order.quote_approved,
                quotePdf: order.quote_pdf,
                quotePdfName: order.quote_pdf_name,
                materials: order.materials || [],
                deliveryAddress: order.delivery_address,
                deliveryDate: order.delivery_date,
                progress: order.progress
            }));

            setOrders(transformedOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            alert('Error loading orders: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMaterial = () => {
        if (materialInput.item && materialInput.quantity && materialInput.cost) {
            setFormData(prev => ({
                ...prev,
                materials: [...prev.materials, { ...materialInput, id: Date.now() }]
            }));
            setMaterialInput({ item: '', quantity: '', cost: '' });
        }
    };

    const handleRemoveMaterial = id => {
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter(m => m.id !== id)
        }));
    };

    const handlePdfUpload = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = event => {
                setFormData(prev => ({
                    ...prev,
                    quotePdf: event.target.result,
                    quotePdfName: file.name
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleInputChange = e => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSaveOrder = async () => {
        if (!formData.customerName || !formData.product) {
            alert('Please fill in customer name and product');
            return;
        }

        try {
            const orderData = {
                customer_name: formData.customerName,
                product: formData.product,
                sent_quote: formData.sentQuote,
                quote_approved: formData.quoteApproved,
                quote_pdf: formData.quotePdf,
                quote_pdf_name: formData.quotePdfName,
                materials: formData.materials,
                delivery_address: formData.deliveryAddress,
                delivery_date: formData.deliveryDate || null,
                progress: formData.progress
            };

            if (editingId) {
                const { error } = await supabase
                    .from('orders')
                    .update(orderData)
                    .eq('id', editingId);
                if (error) throw error;
                alert('Order updated successfully!');
            } else {
                const { error } = await supabase
                    .from('orders')
                    .insert([orderData]);
                if (error) throw error;
                alert('Order created successfully!');
            }

            await fetchOrders();
            setEditingId(null);
            setFormData({
                customerName: '',
                product: '',
                sentQuote: false,
                quoteApproved: false,
                quotePdf: null,
                quotePdfName: '',
                materials: [],
                deliveryAddress: '',
                deliveryDate: '',
                progress: 'pending'
            });
        } catch (error) {
            console.error('Error saving order:', error);
            alert('Error saving order: ' + error.message);
        }
    };

    const handleEditOrder = order => {
        setFormData(order);
        setEditingId(order.id);
        setActiveTab('quotes');
    };

    const handleDeleteOrder = async id => {
        if (!confirm('Are you sure you want to delete this order?')) return;

        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);
            if (error) throw error;
            alert('Order deleted successfully!');
            await fetchOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('Error deleting order: ' + error.message);
        }
    };

    const calculateMaterialsCost = () =>
        formData.materials.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0).toFixed(2);

    const totalMaterialsCostInTable = materials =>
        materials.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0).toFixed(2);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="text-2xl font-bold text-amber-900">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-amber-900 mb-2">🪚 Woodworking Business Manager</h1>
                    <p className="text-amber-700">Manage your quotes and deliveries in one place</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b-2 border-amber-200">
                    <button
                        onClick={() => setActiveTab('quotes')}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'quotes'
                                ? 'text-amber-900 border-b-2 border-amber-900'
                                : 'text-amber-700 hover:text-amber-900'
                            }`}
                    >
                        📋 Quotes & Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('delivery')}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'delivery'
                                ? 'text-amber-900 border-b-2 border-amber-900'
                                : 'text-amber-700 hover:text-amber-900'
                            }`}
                    >
                        🚚 Delivery Tracker
                    </button>
                </div>

                {/* Quotes Tab */}
                {activeTab === 'quotes' && (
                    <div className="space-y-6">
                        {/* Create/Edit Form */}
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-amber-900 mb-6">📝 Create/Edit Order</h2>

                            {/* Customer & Product */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-semibold text-amber-900 mb-2">Customer Name</label>
                                    <input
                                        type="text"
                                        name="customerName"
                                        value={formData.customerName}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="Enter customer name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-amber-900 mb-2">Product</label>
                                    <input
                                        type="text"
                                        name="product"
                                        value={formData.product}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="e.g., Dining Table, Cabinet"
                                    />
                                </div>
                            </div>

                            {/* Quote Checkboxes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="sentQuote"
                                        checked={formData.sentQuote}
                                        onChange={handleInputChange}
                                        className="w-5 h-5 text-amber-600"
                                    />
                                    <span className="text-amber-900 font-semibold">📤 Quote Sent</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="quoteApproved"
                                        checked={formData.quoteApproved}
                                        onChange={handleInputChange}
                                        className="w-5 h-5 text-amber-600"
                                    />
                                    <span className="text-amber-900 font-semibold">✅ Quote Approved</span>
                                </label>
                            </div>

                            {/* PDF Upload */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-amber-900 mb-2">Attach Quote PDF</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={handlePdfUpload}
                                        className="flex-1 px-4 py-2 border border-amber-300 rounded-lg"
                                    />
                                    {formData.quotePdfName && (
                                        <span className="text-sm text-green-600 font-semibold">{formData.quotePdfName}</span>
                                    )}
                                </div>
                            </div>

                            {/* Materials */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-amber-900 mb-4">🧰 Materials (Line Items)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                    <input
                                        type="text"
                                        placeholder="Material/Item"
                                        value={materialInput.item}
                                        onChange={e => setMaterialInput({ ...materialInput, item: e.target.value })}
                                        className="px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Quantity"
                                        value={materialInput.quantity}
                                        onChange={e => setMaterialInput({ ...materialInput, quantity: e.target.value })}
                                        className="px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Cost (R)"
                                        value={materialInput.cost}
                                        onChange={e => setMaterialInput({ ...materialInput, cost: e.target.value })}
                                        step="0.01"
                                        className="px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <button
                                        onClick={handleAddMaterial}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Plus size={18} /> Add
                                    </button>
                                </div>

                                {formData.materials.length > 0 && (
                                    <div className="bg-amber-50 rounded-lg p-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b-2 border-amber-200">
                                                    <th className="text-left py-2 px-3 font-semibold text-amber-900">Item</th>
                                                    <th className="text-center py-2 px-3 font-semibold text-amber-900">Qty</th>
                                                    <th className="text-right py-2 px-3 font-semibold text-amber-900">Cost</th>
                                                    <th className="text-center py-2 px-3 font-semibold text-amber-900">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {formData.materials.map(m => (
                                                    <tr key={m.id} className="border-b border-amber-100 hover:bg-amber-100">
                                                        <td className="py-2 px-3">{m.item}</td>
                                                        <td className="text-center py-2 px-3">{m.quantity}</td>
                                                        <td className="text-right py-2 px-3">R{parseFloat(m.cost).toFixed(2)}</td>
                                                        <td className="text-center py-2 px-3">
                                                            <button
                                                                onClick={() => handleRemoveMaterial(m.id)}
                                                                className="text-red-600 hover:text-red-800 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-amber-100 font-bold">
                                                    <td colSpan="2" className="py-2 px-3 text-right">Total:</td>
                                                    <td className="text-right py-2 px-3">R{calculateMaterialsCost()}</td>
                                                    <td></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Delivery */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-semibold text-amber-900 mb-2">Delivery Address</label>
                                    <textarea
                                        name="deliveryAddress"
                                        value={formData.deliveryAddress}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="Enter delivery address"
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-amber-900 mb-2">Delivery Date</label>
                                    <input
                                        type="date"
                                        name="deliveryDate"
                                        value={formData.deliveryDate}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Status */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-amber-900 mb-2">Status</label>
                                <select
                                    name="progress"
                                    value={formData.progress}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="pending">⏳ Pending</option>
                                    <option value="in progress">🚧 In Progress</option>
                                    <option value="completed">✅ Completed</option>
                                </select>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSaveOrder}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                >
                                    {editingId ? 'Update Order ✏️' : 'Create Order ✅'}
                                </button>
                                {editingId && (
                                    <button
                                        onClick={() => {
                                            setEditingId(null);
                                            setFormData({
                                                customerName: '',
                                                product: '',
                                                sentQuote: false,
                                                quoteApproved: false,
                                                quotePdf: null,
                                                quotePdfName: '',
                                                materials: [],
                                                deliveryAddress: '',
                                                deliveryDate: '',
                                                progress: 'pending'
                                            });
                                        }}
                                        className="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
                                    >
                                        Cancel ❌
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Active Orders */}
                        {orders.length > 0 && (
                            <div className="bg-white rounded-lg shadow-lg p-6">
                                <h2 className="text-2xl font-bold text-amber-900 mb-6">📂 Active Orders</h2>
                                <div className="space-y-4">
                                    {orders.map(order => (
                                        <div key={order.id} className="border-l-4 border-amber-600 bg-amber-50 p-5 rounded-lg">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <p className="text-sm text-amber-700 font-semibold">Customer</p>
                                                    <p className="text-lg font-bold text-amber-900">{order.customerName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-amber-700 font-semibold">Product</p>
                                                    <p className="text-lg font-bold text-amber-900">{order.product}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-amber-700 font-semibold">Status</p>
                                                    <p className="text-lg font-bold text-amber-900 capitalize">{order.progress}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-amber-700 font-semibold">Delivery Date</p>
                                                    <p className="text-lg font-bold text-amber-900">{order.deliveryDate || 'Not set'}</p>
                                                </div>
                                            </div>

                                            {order.materials.length > 0 && (
                                                <div className="mb-4 bg-white p-3 rounded">
                                                    <p className="text-sm font-semibold text-amber-900 mb-2">Materials Total: R{totalMaterialsCostInTable(order.materials)}</p>
                                                </div>
                                            )}

                                            {order.quotePdf && (
                                                <div className="mb-4 flex items-center gap-2 bg-white p-3 rounded">
                                                    <FileText size={18} className="text-blue-600" />
                                                    <a
                                                        href={order.quotePdf}
                                                        download={order.quotePdfName}
                                                        className="text-blue-600 hover:text-blue-800 underline font-semibold"
                                                    >
                                                        {order.quotePdfName}
                                                    </a>
                                                </div>
                                            )}

                                            <div className="flex gap-2 flex-wrap mb-3">
                                                {order.sentQuote && (
                                                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">📤 Quote Sent</span>
                                                )}
                                                {order.quoteApproved && (
                                                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">✅ Quote Approved</span>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditOrder(order)}
                                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
                                                >
                                                    Edit ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                                                >
                                                    <Trash2 size={16} /> Delete ❌
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Delivery Tab */}
                {activeTab === 'delivery' && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-2xl font-bold text-amber-900 mb-6">🚚 Delivery Tracker</h2>
                        {orders.length === 0 ? (
                            <p className="text-center text-amber-700 py-8">No orders yet. Create one in the Quotes tab to track deliveries.</p>
                        ) : (
                            <div className="space-y-3">
                                {orders.map(order => (
                                    <div key={order.id}>
                                        <button
                                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                            className="w-full border-2 border-amber-200 rounded-lg p-4 hover:border-amber-400 hover:bg-amber-50 transition-colors text-left flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="text-lg font-bold text-amber-900">{order.customerName}</p>
                                                <p className="text-sm text-amber-700">{order.product}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-amber-700 text-sm">{expandedOrderId === order.id ? '▼ Collapse' : '▶ Expand'}</p>
                                            </div>
                                        </button>

                                        {expandedOrderId === order.id && (
                                            <div className="border-2 border-t-0 border-amber-200 rounded-b-lg p-4 bg-amber-50">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-xs text-amber-700 font-semibold uppercase">Product</p>
                                                        <p className="text-lg font-bold text-amber-900">{order.product}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-amber-700 font-semibold uppercase">Customer Name</p>
                                                        <p className="text-lg font-bold text-amber-900">{order.customerName}</p>
                                                    </div>
                                                </div>

                                                <div className="mb-4 p-3 bg-white rounded">
                                                    <p className="text-xs text-amber-700 font-semibold uppercase mb-2">Delivery Address</p>
                                                    <p className="text-amber-900">{order.deliveryAddress || 'No address provided'}</p>
                                                </div>

                                                {order.materials.length > 0 && (
                                                    <div className="mb-4 p-3 bg-white rounded">
                                                        <p className="text-xs text-amber-700 font-semibold uppercase mb-2">Materials</p>
                                                        <div className="space-y-2">
                                                            {order.materials.map(m => (
                                                                <div key={m.id} className="flex justify-between text-sm text-amber-900">
                                                                    <span>{m.item} (Qty: {m.quantity})</span>
                                                                    <span className="font-semibold">R{parseFloat(m.cost).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                            <div className="border-t border-amber-200 pt-2 mt-2 flex justify-between font-bold text-amber-900">
                                                                <span>Total Materials:</span>
                                                                <span>R{totalMaterialsCostInTable(order.materials)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {order.quotePdf && (
                                                    <div className="mb-4 flex items-center gap-2 bg-white p-3 rounded">
                                                        <FileText size={18} className="text-blue-600" />
                                                        <a
                                                            href={order.quotePdf}
                                                            download={order.quotePdfName}
                                                            className="text-blue-600 hover:text-blue-800 underline font-semibold"
                                                        >
                                                            {order.quotePdfName}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
