import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
    auth, db, googleProvider, 
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
    collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy 
} from './firebase';

// State management
let state = {
    user: null,
    invoiceId: '',
    business: { name: 'My Company', address: '' },
    client: { name: '', address: '' },
    items: [],
    taxRate: 10,
    currency: 'USD',
    savedInvoices: []
};

const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };

// Selectors
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const authForm = document.getElementById('auth-form');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const btnGoogleAuth = document.getElementById('btn-google-auth');
const btnLogout = document.getElementById('btn-logout');

const itemsBody = document.getElementById('items-body');
const subtotalEl = document.getElementById('subtotal-val');
const taxEl = document.getElementById('tax-val');
const grandTotalEl = document.getElementById('grand-total-val');
const previewEl = document.getElementById('invoice-preview');
const addItemBtn = document.getElementById('add-item-btn');
const btnSave = document.getElementById('btn-save');
const btnDownload = document.getElementById('btn-download');
const navCreate = document.getElementById('nav-create');
const navHistory = document.getElementById('nav-history');
const createView = document.getElementById('create-view');
const historyView = document.getElementById('history-view');
const historyList = document.getElementById('history-list');

let isLoginMode = true;

// Initialize
function init() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.user = user;
            showApp();
            loadInvoices();
        } else {
            state.user = null;
            showAuth();
        }
    });

    setupAuthListeners();
    setupEventListeners();
}

function showAuth() {
    authScreen.style.display = 'flex';
    mainApp.style.display = 'none';
}

function showApp() {
    authScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    document.getElementById('user-display-name').textContent = state.user.displayName || state.user.email;
    document.getElementById('user-avatar').textContent = (state.user.displayName || state.user.email).charAt(0).toUpperCase();
    resetInvoice();
}

function resetInvoice() {
    state.invoiceId = 'INV-' + Math.floor(1000 + Math.random() * 9000);
    state.items = [{ id: Date.now(), description: 'New Service', price: 0, qty: 1 }];
    renderItems();
    updateCalculations();
    updateInvoiceId();
}

function setupAuthListeners() {
    authToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        document.getElementById('auth-title').textContent = isLoginMode ? 'Welcome Back' : 'Create Account';
        document.getElementById('auth-btn-text').textContent = isLoginMode ? 'Sign In' : 'Sign Up';
        authToggleBtn.textContent = isLoginMode ? 'Sign Up' : 'Sign In';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        try {
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            alert(error.message);
        }
    });

    btnGoogleAuth.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            alert(error.message);
        }
    });

    btnLogout.addEventListener('click', () => signOut(auth));
}

async function loadInvoices() {
    if (!state.user) return;
    historyList.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading invoices...</p>';
    
    try {
        const q = query(collection(db, "invoices"), where("userId", "==", state.user.uid));
        const querySnapshot = await getDocs(q);
        state.savedInvoices = [];
        querySnapshot.forEach((doc) => {
            state.savedInvoices.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort locally by date descending
        state.savedInvoices.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        renderHistory();
    } catch (error) {
        console.error("Error loading invoices: ", error);
        historyList.innerHTML = `<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error: ${error.message}</p>`;
    }
}

async function saveInvoice() {
    if (!state.user) return;
    
    const invoiceData = {
        userId: state.user.uid,
        invoiceId: state.invoiceId,
        business: state.business,
        client: state.client,
        items: state.items,
        taxRate: state.taxRate,
        currency: state.currency,
        date: new Date().toISOString(),
        total: state.items.reduce((sum, item) => sum + (item.price * item.qty), 0) * (1 + state.taxRate/100)
    };

    try {
        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';
        
        await addDoc(collection(db, "invoices"), invoiceData);
        alert('Invoice saved successfully to Firebase!');
        loadInvoices();
        resetInvoice();
    } catch (error) {
        alert("Error saving invoice: " + error.message);
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Save Draft';
    }
}

function renderItems() {
    itemsBody.innerHTML = '';
    state.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${item.description}" placeholder="Description" data-id="${item.id}" data-field="description"></td>
            <td><input type="number" value="${item.price}" style="width: 80px" data-id="${item.id}" data-field="price"></td>
            <td><input type="number" value="${item.qty}" style="width: 60px" data-id="${item.id}" data-field="qty"></td>
            <td style="font-weight: 600">${currencySymbols[state.currency]}${(item.price * item.qty).toFixed(2)}</td>
            <td><button class="btn-remove" data-id="${item.id}">×</button></td>
        `;
        
        tr.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const item = state.items.find(i => i.id === parseFloat(e.target.dataset.id));
                const field = e.target.dataset.field;
                item[field] = field === 'description' ? e.target.value : parseFloat(e.target.value) || 0;
                updateCalculations();
            });
        });

        tr.querySelector('.btn-remove').addEventListener('click', () => {
            state.items = state.items.filter(i => i.id !== item.id);
            renderItems();
            updateCalculations();
        });
        itemsBody.appendChild(tr);
    });
}

function updateCalculations() {
    const subtotal = state.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * (state.taxRate / 100);
    const total = subtotal + tax;

    const symbol = currencySymbols[state.currency];
    subtotalEl.textContent = `${symbol}${subtotal.toFixed(2)}`;
    taxEl.textContent = `${symbol}${tax.toFixed(2)}`;
    grandTotalEl.textContent = `${symbol}${total.toFixed(2)}`;
    updatePreview();
}

function updatePreview() {
    const symbol = currencySymbols[state.currency];
    const subtotal = state.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * (state.taxRate / 100);
    const total = subtotal + tax;

    previewEl.innerHTML = `
        <div class="invoice-header">
            <div>
                <h1 class="invoice-title">Invoice</h1>
                <p>ID: ${state.invoiceId}</p>
                <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
            <div style="text-align: right">
                <h2>${state.business.name || 'Your Company'}</h2>
                <p style="white-space: pre-line">${state.business.address}</p>
            </div>
        </div>
        <div class="invoice-details-grid">
            <div class="info-block">
                <h4>Bill To</h4>
                <p style="font-weight: 700">${state.client.name || 'Client Name'}</p>
                <p style="white-space: pre-line">${state.client.address}</p>
            </div>
            <div class="info-block" style="text-align: right">
                <h4>Total Due</h4>
                <h2 style="color: var(--primary-color)">${symbol}${total.toFixed(2)}</h2>
            </div>
        </div>
        <table class="pdf-table">
            <thead><tr><th>Description</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>
                ${state.items.map(i => `<tr><td>${i.description}</td><td>${symbol}${i.price.toFixed(2)}</td><td>${i.qty}</td><td>${symbol}${(i.price * i.qty).toFixed(2)}</td></tr>`).join('')}
            </tbody>
        </table>
        <div class="pdf-totals">
            <div class="pdf-total-row"><span>Subtotal</span><span>${symbol}${subtotal.toFixed(2)}</span></div>
            <div class="pdf-total-row"><span>Tax (${state.taxRate}%)</span><span>${symbol}${tax.toFixed(2)}</span></div>
            <div class="pdf-total-row final"><span>Grand Total</span><span>${symbol}${total.toFixed(2)}</span></div>
        </div>
    `;
}

function renderHistory() {
    if (state.savedInvoices.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">No invoices saved yet.</p>';
        return;
    }

    historyList.innerHTML = `
        <table class="items-table">
            <thead><tr><th>ID</th><th>Client</th><th>Date</th><th>Total</th><th>Actions</th></tr></thead>
            <tbody>
                ${state.savedInvoices.map(inv => `
                    <tr>
                        <td>${inv.invoiceId}</td>
                        <td>${inv.client.name || 'No Name'}</td>
                        <td>${new Date(inv.date).toLocaleDateString()}</td>
                        <td style="font-weight: 700">${currencySymbols[inv.currency]}${inv.total.toFixed(2)}</td>
                        <td>
                            <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="window.loadInvoice('${inv.id}')">View</button>
                            <button class="btn-remove" onclick="window.deleteInvoice('${inv.id}')" style="margin-left: 8px;">×</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

window.loadInvoice = (docId) => {
    const inv = state.savedInvoices.find(i => i.id === docId);
    if (inv) {
        state.invoiceId = inv.invoiceId;
        state.business = {...inv.business};
        state.client = {...inv.client};
        state.items = [...inv.items];
        state.taxRate = inv.taxRate;
        state.currency = inv.currency;

        // Sync inputs
        document.getElementById('biz-name').value = state.business.name;
        document.getElementById('biz-address').value = state.business.address;
        document.getElementById('client-name').value = state.client.name;
        document.getElementById('client-address').value = state.client.address;
        document.getElementById('tax-rate').value = state.taxRate;
        document.getElementById('currency').value = state.currency;

        renderItems();
        updateCalculations();
        updateInvoiceId();
        showSection('create');
    }
};

window.deleteInvoice = async (docId) => {
    if (confirm('Delete this invoice?')) {
        try {
            await deleteDoc(doc(db, "invoices", docId));
            loadInvoices();
        } catch (error) {
            alert(error.message);
        }
    }
};

function setupEventListeners() {
    document.getElementById('biz-name').addEventListener('input', (e) => { state.business.name = e.target.value; updatePreview(); });
    document.getElementById('biz-address').addEventListener('input', (e) => { state.business.address = e.target.value; updatePreview(); });
    document.getElementById('client-name').addEventListener('input', (e) => { state.client.name = e.target.value; updatePreview(); });
    document.getElementById('client-address').addEventListener('input', (e) => { state.client.address = e.target.value; updatePreview(); });
    document.getElementById('tax-rate').addEventListener('input', (e) => { state.taxRate = parseFloat(e.target.value) || 0; updateCalculations(); });
    document.getElementById('currency').addEventListener('change', (e) => { state.currency = e.target.value; updateCalculations(); });

    addItemBtn.addEventListener('click', () => {
        state.items.push({ id: Date.now(), description: '', price: 0, qty: 1 });
        renderItems();
    });

    btnSave.addEventListener('click', saveInvoice);
    btnDownload.addEventListener('click', downloadPDF);

    navCreate.addEventListener('click', () => showSection('create'));
    navHistory.addEventListener('click', () => showSection('history'));
}

function showSection(section) {
    createView.style.display = section === 'create' ? 'block' : 'none';
    historyView.style.display = section === 'history' ? 'block' : 'none';
    navCreate.classList.toggle('active', section === 'create');
    navHistory.classList.toggle('active', section === 'history');
}

function updateInvoiceId() {
    const el = document.getElementById('invoice-id-display');
    if (el) el.textContent = `Invoice #${state.invoiceId}`;
}

async function downloadPDF() {
    const btn = document.getElementById('btn-download');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Generating...';
    btn.disabled = true;

    try {
        const preview = document.getElementById('invoice-preview');
        const originalTransform = preview.style.transform;
        const originalMargin = preview.style.marginBottom;
        const originalBoxShadow = preview.style.boxShadow;

        preview.style.transform = 'none';
        preview.style.marginBottom = '0';
        preview.style.boxShadow = 'none';

        const canvas = await html2canvas(preview, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Invoice-${state.invoiceId}.pdf`);

        preview.style.transform = originalTransform;
        preview.style.marginBottom = originalMargin;
        preview.style.boxShadow = originalBoxShadow;
    } catch (err) {
        console.error('PDF Generation failed', err);
        alert('Failed to generate PDF.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

init();
