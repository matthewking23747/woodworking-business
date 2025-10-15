import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, FileText } from 'lucide-react';
import { supabase } from './supabaseClient';
import jsPDF from "jspdf";

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
    // --- PDF Form State ---
    const [pdfForm, setPdfForm] = useState({
        clientName: '',
        product: '',
        notes: '',
        total: '',
        lineItems: [{ description: '', price: '' }],
        contactName: 'Keith King',
        contactEmail: 'custom.cwc.creations@gmail.com',
        contactPhone: '0810394506',
        bankDetails: 'Bank: FNB\nACC: 62768032121',
    });
    // --- Logo Helper (add here, inside component but outside generatePDF) ---
    const fetchLogoBase64 = async () => {
        const res = await fetch('/CWC Logo.png'); // path to your image in public folder
        const blob = await res.blob();
        const reader = new FileReader();
        return new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    };
    // --- ADD THIS LINE HERE ---
    const fileInputRef = useRef(null);

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
                // Update existing order...
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

                setOrders(prev => prev.map(o => (o.id === editingId ? { ...o, ...formData } : o)));
                setEditingId(null);
            } else {
                // Insert new order...
                const { data, error } = await supabase
                    .from('orders')
                    .insert([{
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
                    }])
                    .select();
                if (error) throw error;

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

            // --- Reset form fully after saving ---
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

            // --- CLEAR FILE INPUT FOR BOTH NEW AND EDIT ---
            if (fileInputRef.current) fileInputRef.current.value = '';

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
    // --- Generate PDF ---
    const generatePDF = () => {
        const { clientName, product, notes, lineItems, contactName, contactEmail, contactPhone, bankDetails } = pdfForm;

        if (!clientName || !product) {
            alert('Client Name and Product Description are required.');
            return;
        }

        const doc = new jsPDF();

        let startX = 20;
        let startY = 20;
        const tableWidth = 170;
        const rowHeight = 10;
        const colDescriptionWidth = 120;
        const colPriceWidth = tableWidth - colDescriptionWidth;
        const cellPadding = 2;

        // --- Add Logo ---
        const logoBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAMgAyADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3zNJk/wCRQetJSGLn/OKM/wCcUlFAC5Pt+VGf84pKKAFz9Pyoz/nFJS0AGfp+VGT/AJFJRQAufp+VGfp+VJRQAuaMmikoAXP0/KjP0/KkooAXP+cUZP8AkUlFAC5/zijP+cUlFAC5/wA4oz9KKTvQAuaM/T8qSigBc/5xRn6flSd6KAFz9Pyoz/nFJRQAuf8AOKM/T8qSigBc/wCcUZ+n5UlFAC5P+RRn/OKKKADP+cUZ/wA4pKKAFyfajJ/yKSigBcmjP+cUUlAC5oz/AJxSUtABn6flRn6UUlAC5P8AkUZpKKAFz/nFGf8AOKSigBc/5xRk0UUAGf8AOKM/T8qKKADNGf8AOKSloAM/5xRn/OKSigBc/wCcUZNFFABn/OKM/T8qSigBc/5xRk+35UlFAC5P+RRn/OKSigBc/T8qM/5xRSUALn/OKM/5xSUUALmjP0/KikoAXP0/KjP+cUlLQAZoz/nFJRQAuT/kUZ/zikooAXP+cUZ+lJRQAuf84oz/AJxSUUALn/OKM/5xSUUALn/OKM/T8qSigBc/5xRn6UlFAC5oz/nFJRQAuaM/5xSUUALn6flRn/OKSigBc/5xRn6flRSUALn/ADijP+cUlLQAZ/zijJ9qKKADJoz/AJxSUtAAaSlPWkoAKKKWgApKKKACiiigAooooAKWikoAKWkooAKKKWgApKKKAClpKWgBKKKKACiiigApaSigApaSigApaKSgAooooAKKWkoAWkoooAKKKKACilooASiiigBaKSigBaSiigBaKSigApaKSgBaSiloASlpKKACiiigBaSiigBaSlpKACiil7UAFJRRQAtFJRQAUUUUAFLSUUALRSUUAFLSUUALSUUUAFFFFABRRS0AJRRRQAUtJRQAUUUUAFLSUtABSUUtACUUtFABSUUUAFFLSUAFLRRQAUUlLQAHrSUp60lABS0UUAJRRRQAUtFFACUUtFACUtJS0AJS0UlAC0UlLQAlFFFABRRS0AJRRRQAUUUUAFLRSUAFLSUtACUUUtACUtFJQAUUUUAFFFFABRRRQAUUUtACUUUtACUUtJQAUUtFACUtJS0AFFFJQAtJS0UAJS0UUAFJS0lABRRRQAUUUtACUUUUAFFFFABRRRQAUUtJQAUUtFACUtFJQAUUtFACUUUUAFLRRQAlFFLQAlLSUUAFLSUtACUUUtABSUUtABSUUtABRRSUALSUtJQAtFFFACUUUtABR/hRR/hQAGkpT1ooAKKSigBaSiigAooooAWikpaAEopaSgAooooAWkpaKACkopaACkoooAWkpaSgApaSigBaKSloASilooAKSlpKACiiloASiiigAoopaACkoooAKKKWgBKWkooAKKKWgAopKWgAoopKACiiloAKSiigAoopaACikooAWikooAWkopaACkoooAKKKKACiiigAooooAWikpaAEooooAWkpaSgBaSlpKAFoopKAFpKKKACiiigAopaSgAopaSgApaSloAKSiloAKKKSgAopaKACiiigApKKWgBKWiigANJSmkoAKWkooAKKKKACig0UAFLSUUA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ooooAWiiigApKKWgBKKWkoAKKWkoAKWkpaACkoooAKKKKAClpKWgBKKKWgBKWkooAKWiigBKKWigBKWiigBKWkpaAEpaKKAEpaKKAEopaSgAooooAKKWkoAWikooAKKWigAopKWgBKKKKACiiloASilpKAFpKKWgApKWigBKKWigBKKWigAooooAKKKSgBaKKKACiiigBKWkxS0AJS0lLQAUlLSUALRSUUALSUtFABSUtFACUUUUALRRRQAGkpT1pKAClpKKACiiigAooooAKWkooAWiiigApKWkoAWikooAKWikoAKWkpaAEoopaACikooAWiikoAWiikoAWkoooAKKWigBKKKWgAoopKAFpKKWgBKWikoAWiiigBKWiigBKKKWgBKWiigAopKKAFopKWgAooooASlpKWgBKWiigBKKWkoAKWkpaACkoooAWkpaSgBaSiigBaKSigBaSlpKAClopKAFopKKAFopKKAFpKWigAooooAKKSigApaSloAKSlooASlpKKAFopKKAClopKAFpKKWgApKWkoAWikooAU9aSlPWkoAWkopaAEopaKACkpaKAEpaKKACkopaAEopaKAEpaKKACiikoAWiikoAWkpaSgApaKKAEopaSgAopaSgBaSlpKACilooAKSiigApaKSgAoopaACiiigBKKWigAoopKAFpKWkoAKKKWgAooooAKSlpKAClpKKACilpKAFooooAKKKKACikooAWikooAWkopaAEooooAWikooAWkpaKAEopaKAEoopaACkpaKACiikoAKWikoAKWikoAKKWkoAWiikoAWkpaSgApaKKACkpaKAEpaKKAEopaSgApaKKAA9aSlPWkoAKKKKAClpKKACiiloASiiloAKKKKAEopaSgBaKKKACiikoAWkopaACkoooAWikooAKKKKACilooAKSlooASiiigAopaKAEpaSigBaSiloASilooASiiigBaKKKACkoooAKKKWgApKWigApKKKAFopKWgBKKWigBKWikoAKKKWgBKWikoAWkopaAEopaSgAooooAWkoooAWkopaACkoooAKWkooAWkpaSgBaSlooASiiigBaSlooAKKSloASloooAKKKSgBaKSloASilpKAFopKWgAopKKAClpKWgAPWkpT1pKAClpKKAClpKKACiiigApaSigAooooAKKKKACiiloASiiigBaSiigBaSiigAooooAKKKKAClopKAFpKKKACiiigAooooAWkpaSgAooooAWkopaAEooooAWkoooAKWkooAKKKKACiiigAooooAKKKKAFpKKKACiiigAooooAWkoooAKKKKACiiigAopaSgAoopaAEpaKSgApaSigApaSigAopaSgApaSigAooooAWkoooAKWkpaACkoooAKKKKACiiigBaKSigBaSiigAopaSgApaSloAD1pKU9aSgAooooAKKKKACiiigAooooAKKKKAClpKWgBKKWigApKKKACiiigAoopaAEooooAKWkooAKWkooAWkpaKAEopaSgAopaSgAooooAWikooAKKKWgBKKKWgBKKKKACiiloASlpKKACloooAKKKSgBaKKKACikpaAEpaSloAKSiigApaSigAooooAKWkooAKWikoAKKWigBKWiigBKKKKAFopKWgApKWkoAKKKKACilpKADvS0UlABS0UlAC0lFFABRRS0AFJRRQAtJS0lABS0UUAFFFJQAtFJRQAp60lKaPy/OgBKKKX8vzoASlpP89aX8vzoASil/z1o/L86AEopfy/OigBKKX8qPy/OgBKKX8vzo/L86ACkpf89aP89aAEopfy/Oj/PWgApKWj8vzoASlo/Kj8R+dACUUv5Ufl+dACUUv5UflQAlFL+X50flQAlLRj/OaP8APWgBKWj8vzooASil/L86Py/OgBKKX8qT8vzoAKKPypfyoASlo/L86P8APWgApKX8qKACkpfy/OjH+c0AJS0fl+dH5fnQAUlL/nrR+X50AJS0fl+dH5fnQAUlL+I/Oj8qAEpaMf5zRQAlLSY/zml/KgBKWj8qPyoAKKPy/Oj/AD1oAKKP89aPy/OgBKKXH0/Oj8vzoASil/Kj8vzoASil/Kj8vzoASil/L86KAEopfy/Oj8vzoASloo/L86ACij8vzooASil/Kj8qAEopfyooASloooASlo/z1ox9KACij8vzo/KgBKWjH0/Oj8qAEpaPy/Oj8vzoAKKKKACij8vzo/z1oASil/L86MfSgAoo/EUUAJRS/wCetFAH/9k=';
        const maxLogoWidth = 35; // mm
        const maxLogoHeight = 20; // mm
        const logoRatio = 1.8; // width / height of your logo

        let logoWidth = maxLogoWidth;
        let logoHeight = maxLogoWidth / logoRatio;
        if (logoHeight > maxLogoHeight) {
            logoHeight = maxLogoHeight;
            logoWidth = logoHeight * logoRatio;
        }

        // Add logo
        doc.addImage(logoBase64, 'PNG', startX, startY, logoWidth, logoHeight);

        // --- Header Text next to logo ---
        const headerColor = '#7c4a00';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(headerColor);
        doc.text('Custom Wood Creations', startX + logoWidth + 5, startY + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor('#000000');
        doc.text('Handcrafted Quality | Custom Furniture | For Real Homes and Real People', startX + logoWidth + 5, startY + 16);

        // --- Move startY below logo ---
        startY += Math.max(logoHeight, 20) + 5;

        // --- Horizontal line ---
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(startX, startY, startX + tableWidth, startY);
        startY += 8;

        // --- Quote Info ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#000000');

        // Client name (left)
        doc.text(`Client Name: ${clientName}`, startX, startY);

        // Date (right)
        const currentDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        doc.text(`Date: ${currentDate}`, startX + tableWidth, startY, { align: 'right' });

        startY += 8;
        doc.text(`Product Description: ${product}`, startX, startY);
        startY += 8;

        if (notes) {
            doc.text(`Notes: ${notes}`, startX, startY);
            startY += 8;
        }
        startY += 5;

        // --- Table Header ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor('#000000');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);

        // Light grey background
        doc.setFillColor(220, 220, 220); // very light grey
        doc.rect(startX, startY, tableWidth, rowHeight, 'FD'); // fill + stroke
        doc.line(startX + colDescriptionWidth, startY, startX + colDescriptionWidth, startY + rowHeight);

        const headerTextY = startY + 7;
        const descCenterX = startX + colDescriptionWidth / 2;
        const priceCenterX = startX + colDescriptionWidth + (colPriceWidth / 2);

        doc.text('Description', descCenterX, headerTextY, { align: 'center' });
        doc.text('Price (R)', priceCenterX, headerTextY, { align: 'center' });

        startY += rowHeight;

        // --- Table Rows ---
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#000000');
        let total = 0;

        lineItems.forEach(item => {
            const price = parseFloat(item.price || 0);
            total += price;

            doc.rect(startX, startY, tableWidth, rowHeight); // row border
            doc.line(startX + colDescriptionWidth, startY, startX + colDescriptionWidth, startY + rowHeight); // vertical line
            doc.text(item.description, startX + 2, startY + 7);
            doc.text(price.toFixed(2), startX + tableWidth - 2, startY + 7, { align: 'right' });

            startY += rowHeight;
        });

        // --- Grand Total ---
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#008000'); // green
        doc.rect(startX, startY, tableWidth, rowHeight);
        doc.line(startX + colDescriptionWidth, startY, startX + colDescriptionWidth, startY + rowHeight);
        doc.text('Grand Total', startX + cellPadding, startY + 7);
        doc.text(total.toFixed(2), startX + tableWidth - cellPadding, startY + 7, { align: 'right' });

        startY += rowHeight + 10;

        // --- Contact Details ---
        doc.setTextColor('#000000');
        doc.setFont('helvetica', 'bold');
        doc.text('Contact Details', startX, startY);
        startY += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`Name: ${contactName}`, startX, startY);
        startY += 7;
        doc.text(`Email: ${contactEmail}`, startX, startY);
        startY += 7;
        doc.text(`Phone: ${contactPhone}`, startX, startY);
        startY += 10;

        // --- Bank Details ---
        doc.setFont('helvetica', 'bold');
        doc.text('Bank Details', startX, startY);
        startY += 8;
        doc.setFont('helvetica', 'normal');
        bankDetails.split('\n').forEach(line => {
            doc.text(line, startX, startY);
            startY += 7;
        });

        doc.save(`${clientName.replace(/\s/g, '_')}_Quote.pdf`);
    };
    // --- Clear specific PDF form fields ---
    const clearPDFForm = () => {
        setPdfForm(prev => ({
            ...prev,          // keep the rest of the data intact
            clientName: '',
            product: '',
            lineItems: [],    // clear all line items
        }));
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
                    <button
                        onClick={() => setActiveTab('pdf')}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'pdf'
                                ? 'text-amber-900 border-b-2 border-amber-900'
                                : 'text-amber-700 hover:text-amber-900'
                            }`}
                    >
                        🧾 Quote Generator
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
                                        ref={fileInputRef}   // <-- add this line
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
                                            // Reset form fully after saving
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
                                            if (fileInputRef.current) fileInputRef.current.value = '';

                                            // Clear the file input
                                            if (fileInputRef.current) fileInputRef.current.value = '';
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
                {/* PDF Generator Tab */}
                {activeTab === 'pdf' && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-2xl font-bold text-amber-900 mb-6">🧾 Quote Generator</h2>

                        {/* Client & Product */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-semibold text-amber-900 mb-2">
                                    Client Name
                                </label>
                                <input
                                    type="text"
                                    value={pdfForm.clientName}
                                    onChange={(e) => setPdfForm({ ...pdfForm, clientName: e.target.value })}
                                    placeholder="Enter client name"
                                    className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-amber-900 mb-2">
                                    Product Description
                                </label>
                                <input
                                    type="text"
                                    value={pdfForm.product}
                                    onChange={(e) => setPdfForm({ ...pdfForm, product: e.target.value })}
                                    placeholder="e.g., Kiaat Table 3m x 1m"
                                    className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-amber-900 mb-2">Line Items</h3>
                            {pdfForm.lineItems.map((item, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => {
                                            const updated = [...pdfForm.lineItems];
                                            updated[index].description = e.target.value;
                                            setPdfForm({ ...pdfForm, lineItems: updated });
                                        }}
                                        placeholder="Description"
                                        className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    />
                                    <input
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => {
                                            const updated = [...pdfForm.lineItems];
                                            updated[index].price = e.target.value;
                                            setPdfForm({ ...pdfForm, lineItems: updated });
                                        }}
                                        placeholder="Price"
                                        className="w-24 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    />
                                    <button
                                        onClick={() => {
                                            const updated = pdfForm.lineItems.filter((_, i) => i !== index);
                                            setPdfForm({ ...pdfForm, lineItems: updated });
                                        }}
                                        className="px-3 py-2 bg-red-500 text-white rounded-lg"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => setPdfForm({ ...pdfForm, lineItems: [...pdfForm.lineItems, { description: '', price: '' }] })}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg mb-2"
                            >
                                + Add Line Item
                            </button>
                        </div>

                        {/* Grand Total */}
                        <div className="mb-4 text-right font-bold text-amber-900">
                            Grand Total: R{pdfForm.lineItems.reduce((acc, item) => acc + parseFloat(item.price || 0), 0).toFixed(2)}
                        </div>

                        {/* Contact Details */}
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-amber-900 mb-2">Contact Details</h3>
                            <input
                                type="text"
                                value={pdfForm.contactName}
                                onChange={(e) => setPdfForm({ ...pdfForm, contactName: e.target.value })}
                                placeholder="Name"
                                className="w-full px-4 py-2 border border-amber-300 rounded-lg mb-2 focus:ring-2 focus:ring-amber-500"
                            />
                            <input
                                type="email"
                                value={pdfForm.contactEmail}
                                onChange={(e) => setPdfForm({ ...pdfForm, contactEmail: e.target.value })}
                                placeholder="Email"
                                className="w-full px-4 py-2 border border-amber-300 rounded-lg mb-2 focus:ring-2 focus:ring-amber-500"
                            />
                            <input
                                type="text"
                                value={pdfForm.contactPhone}
                                onChange={(e) => setPdfForm({ ...pdfForm, contactPhone: e.target.value })}
                                placeholder="Phone Number"
                                className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        {/* Bank Details */}
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-amber-900 mb-2">Bank Details</h3>
                            <textarea
                                value={pdfForm.bankDetails}
                                onChange={(e) => setPdfForm({ ...pdfForm, bankDetails: e.target.value })}
                                placeholder=""
                                className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                rows={3}
                            />
                        </div>

                        <button
                            onClick={generatePDF}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                        >
                            Generate PDF 📄
                        </button>
                        {/* --- Add Clear button here --- */}
                        <button
                            onClick={clearPDFForm}
                            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 ml-2"
                        >
                            Clear
                        </button>
                    </div>
                )}
                    </div>
                

            </div>
       
    );
}
