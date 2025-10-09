import React, { useState, useEffect } from 'react';
import { Trash2, Plus, FileText } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function App() {
    // --- Password Gate State ---
    const [enteredPassword, setEnteredPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const PASSWORD = 'Z@n3260918'; // <-- Set your password here

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (enteredPassword === PASSWORD) {
            setIsAuthenticated(true);
        } else {
            alert('Incorrect password');
            setEnteredPassword('');
        }
    };

    // --- WoodworkingBusiness State ---
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
        progress: 'pending',
        notes: ''
    });
    const [materialInput, setMaterialInput] = useState({ item: '', quantity: '', cost: '' });

    // --- Delivery Date Color Helper ---
    // <-- PUT THIS HERE, after your state declarations
    const getDeliveryDateStyles = (deliveryDate) => {
        if (!deliveryDate) return 'bg-gray-300 text-gray-800'; // No date set

        const today = new Date();
        const delivery = new Date(deliveryDate);

        // ✅ Compare only calendar dates (ignore hours/minutes)
        today.setHours(0, 0, 0, 0);
        delivery.setHours(0, 0, 0, 0);

        const diffTime = delivery - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return 'bg-red-600 text-white';     // today or past = red
        if (diffDays <= 3) return 'bg-orange-500 text-white';  // within 3 days = orange
        return 'bg-green-600 text-white';                      // later = green
    };

    // --- Fetch Orders ---
    useEffect(() => {
        if (isAuthenticated) fetchOrders();
    }, [isAuthenticated]);

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
                progress: order.progress,
                createdAt: order.created_at,
                notes: order.notes
            }));

            setOrders(transformedOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            alert('Error loading orders: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Handler Functions ---
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handlePdfUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Make filename unique using timestamp
            const fileName = `${Date.now()}_${file.name}`;

            // Upload the file to the public 'quotes' bucket
            const { error: uploadError } = await supabase
                .storage
                .from('quotes')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get the public URL for everyone to access
            const { data, error: urlError } = supabase
                .storage
                .from('quotes')
                .getPublicUrl(fileName);

            if (urlError) throw urlError;

            // Save the public URL in your formData
            setFormData(prev => ({
                ...prev,
                quotePdf: data.publicUrl,
                quotePdfName: file.name
            }));

        } catch (error) {
            console.error('Error uploading PDF:', error);
            alert('Error uploading PDF: ' + error.message);
        }
    };

    const handleAddMaterial = () => {
        if (!materialInput.item) return;
        setFormData(prev => ({
            ...prev,
            materials: [...prev.materials, { ...materialInput, id: Date.now() }]
        }));
        setMaterialInput({ item: '', quantity: '', cost: '' });
    };

    const handleRemoveMaterial = (id) => {
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter(m => m.id !== id)
        }));
    };

    const calculateMaterialsCost = () => {
        return formData.materials.reduce((sum, m) => sum + parseFloat(m.cost || 0), 0).toFixed(2);
    };

    const totalMaterialsCostInTable = (materials) => {
        return materials.reduce((sum, m) => sum + parseFloat(m.cost || 0), 0).toFixed(2);
    };

    // --- Save Order ---
    const handleSaveOrder = async () => {
        if (!formData.customerName || !formData.product) {
            alert('Customer Name and Product are required.');
            return;
        }

        try {
            if (editingId) {
                // Update existing order in Supabase
                const { error } = await supabase
                    .from('orders')
                    .update({
                        customer_name: formData.customerName,
                        product: formData.product,
                        sent_quote: formData.sentQuote,
                        quote_approved: formData.quoteApproved,
                        quote_pdf: formData.quotePdf,
                        quote_pdf_name: formData.quotePdfName,
                        materials: formData.materials,
                        delivery_address: formData.deliveryAddress,
                        delivery_date: formData.deliveryDate,
                        progress: formData.progress,
                        notes: formData.notes
                    })
                    .eq('id', editingId);
                if (error) throw error;

                // Update local state
                setOrders(prev => prev.map(o => (o.id === editingId ? { ...o, ...formData } : o)));
                setEditingId(null);
            } else {
                // Insert new order into Supabase
                const { data, error } = await supabase
                    .from('orders')
                    .insert([
                        {
                            customer_name: formData.customerName,
                            product: formData.product,
                            sent_quote: formData.sentQuote,
                            quote_approved: formData.quoteApproved,
                            quote_pdf: formData.quotePdf,
                            quote_pdf_name: formData.quotePdfName,
                            materials: formData.materials,
                            delivery_address: formData.deliveryAddress,
                            delivery_date: formData.deliveryDate,
                            progress: formData.progress,
                            notes: formData.notes,
                            created_at: new Date()
                        }
                    ])
                    .select();
                if (error) throw error;

                // Add to local state with returned Supabase ID
                setOrders(prev => [...prev, {
                    id: data[0].id,
                    customerName: data[0].customer_name,
                    product: data[0].product,
                    sentQuote: data[0].sent_quote,
                    quoteApproved: data[0].quote_approved,
                    quotePdf: data[0].quote_pdf,
                    quotePdfName: data[0].quote_pdf_name,
                    materials: data[0].materials,
                    deliveryAddress: data[0].delivery_address,
                    deliveryDate: data[0].delivery_date,
                    progress: data[0].progress,
                    notes: data[0].notes,
                    createdAt: data[0].created_at
                }]);
            }

            // Reset form
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
                progress: 'pending',
                notes: ''
            });

        } catch (error) {
            console.error('Error saving order:', error);
            alert('Error saving order: ' + error.message);
        }
    };

    // --- Edit Order ---
    const handleEditOrder = (order) => {
        setEditingId(order.id);
        setFormData({
            customerName: order.customerName,
            product: order.product,
            sentQuote: order.sentQuote,
            quoteApproved: order.quoteApproved,
            quotePdf: order.quotePdf,
            quotePdfName: order.quotePdfName,
            materials: order.materials,
            deliveryAddress: order.deliveryAddress,
            deliveryDate: order.deliveryDate,
            progress: order.progress,
            notes: order.notes
        });
    };

    // --- Delete Order ---
    const handleDeleteOrder = async (id) => {
        if (!confirm('Are you sure you want to delete this order?')) return;

        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);
            if (error) throw error;

            // Remove from local state
            setOrders(prev => prev.filter(o => o.id !== id));
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('Error deleting order: ' + error.message);
        }
    };

    // --- Password Gate Render ---


    // --- Password Gate Render ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                <h1 className="text-2xl font-bold text-amber-900 mb-4">Enter Password</h1>
                <form onSubmit={handlePasswordSubmit}>
                    <input
                        type="password"
                        value={enteredPassword}
                        onChange={(e) => setEnteredPassword(e.target.value)}
                        placeholder="Password"
                        className="px-4 py-2 border border-amber-300 rounded mb-3 w-64 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                        type="submit"
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-semibold"
                    >
                        Submit
                    </button>
                </form>
            </div>
        );
    }

    // --- Loading State ---
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="text-2xl font-bold text-amber-900">Loading...</div>
            </div>
        );
    }

    // --- Main App Render ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-amber-900 mb-2">🪚 Custom Wood Creations Business Manager</h1>
                    <p className="text-amber-700">Handcrafted Quality | Custom Furniture | For Real Homes and Real People</p>
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
                        🧰 Job Status
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
                            <div className="mb-6">
                                {/* Notes */}
                                <label className="block text-sm font-semibold text-gray-700">Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    onFocus={() => {
                                        // When focused and empty, start with "1. "
                                        if (!formData.notes.trim()) {
                                            setFormData({ ...formData, notes: '1. ' });
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const lines = formData.notes.split('\n');
                                            const lastLine = lines[lines.length - 1];
                                            const match = lastLine.match(/^(\d+)\.\s/);
                                            let nextNumber = 1;

                                            if (match) {
                                                nextNumber = parseInt(match[1]) + 1;
                                            } else if (lines.length > 0 && lastLine.trim() !== '') {
                                                nextNumber = lines.length + 1;
                                            }

                                            setFormData({
                                                ...formData,
                                                notes: formData.notes + `\n${nextNumber}. `,
                                            });
                                        }
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded mt-1"
                                    rows="3"
                                    placeholder="Enter notes..."
                                />
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
                                                progress: 'pending',
                                                notes: formData.notes
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
                                            {/* Delivery Address */}
                                            <div className="mb-3 p-3 bg-white rounded">
                                                <p className="text-xs text-amber-700 font-semibold uppercase mb-1">Delivery Address</p>
                                                <p className="text-amber-900">{order.deliveryAddress || 'No address provided'}</p>
                                            </div>

                                            {/* Notes */}
                                            {order.notes && (
                                                <div className="mb-3 p-3 bg-white rounded">
                                                    <p className="text-xs text-amber-700 font-semibold uppercase mb-1">Notes</p>
                                                    <p
                                                        className="text-amber-900 whitespace-pre-line"
                                                    >
                                                        {order.notes}
                                                    </p>
                                                </div>
                                            )}

                                            {order.materials.length > 0 && (
                                                <div className="mb-4 bg-white p-3 rounded">
                                                    <p className="text-sm font-semibold text-amber-900 mb-2">Materials Total: R{totalMaterialsCostInTable(order.materials)}</p>
                                                </div>
                                            )}

                                            {order.quotePdf && (
                                                <div className="mb-4 flex items-center gap-2 bg-white p-3 rounded">
                                                    <FileText size={18} className="text-blue-600" />
                                                    <a
                                                        href={order.quotePdf}                // public URL
                                                        target="_blank"                       // open in new tab
                                                        rel="noopener noreferrer"
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
                        <h2 className="text-2xl font-bold text-amber-900 mb-6">⚙️ Job Status</h2>
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
                                            <div className="w-full">
                                                {/* Dates */}
                                                <div className="flex justify-between mb-1 text-xs text-black w-full">
                                                    <span>Created: {new Date(order.createdAt).toLocaleDateString()}</span>

                                                    {/* Delivery Date Bubble */}
                                                    <span
                                                        className={`text-right px-3 py-1 rounded-full text-sm font-medium shadow-sm border border-gray-200 ${getDeliveryDateStyles(order.deliveryDate)}`}
                                                    >
                                                        Delivery: {order.deliveryDate
                                                            ? new Date(order.deliveryDate).toLocaleDateString()
                                                            : 'Not set'}
                                                    </span>
                                                </div>

                                                {/* Customer and Status */}
                                                <p className="text-lg font-bold text-amber-900">
                                                    {order.customerName} —{' '}
                                                    <span
                                                        className={`capitalize font-semibold ${order.progress === 'pending'
                                                                ? 'text-orange-500'
                                                                : order.progress === 'in progress'
                                                                    ? 'text-blue-600'
                                                                    : 'text-green-600'
                                                            }`}
                                                    >
                                                        {order.progress}
                                                    </span>
                                                </p>


                                                {/* Product */}
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
                                                {/* Add Quote Status Badges here */}
                                                <div className="flex gap-2 flex-wrap mb-3">
                                                    {order.sentQuote && (
                                                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                                                            📤 Quote Sent
                                                        </span>
                                                    )}
                                                    {order.quoteApproved && (
                                                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                                                            ✅ Quote Approved
                                                        </span>
                                                    )}
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
                                                            href={order.quotePdf}                // public URL
                                                            target="_blank"                       // open in new tab
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-800 underline font-semibold"
                                                        >
                                                            {order.quotePdfName}
                                                        </a>
                                                    </div>
                                                )}
                                                {/* Notes */}
                                                {order.notes && (
                                                    <div className="mb-4 p-3 bg-white rounded">
                                                        <p className="text-xs text-amber-700 font-semibold uppercase mb-1">Notes</p>
                                                        <p
                                                            className="text-amber-900 whitespace-pre-line"
                                                        >
                                                            {order.notes}
                                                        </p>
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
