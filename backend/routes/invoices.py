from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse
from datetime import datetime, timezone
from db import db
from auth import get_current_user

router = APIRouter()


@router.get("/invoices/{car_id}")
async def get_invoice_html(car_id: str, current_user: dict = Depends(get_current_user)):
    """
    Araç faturasını HTML/PDF formatında döndürür
    """
    org_id = current_user.get("org_id", current_user["user_id"])
    
    # Aracı getir
    car = await db.cars.find_one({"id": car_id, "org_id": org_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Faturalı alım kontrolü
    if not car.get("is_invoiced"):
        raise HTTPException(status_code=400, detail="Bu araç faturasız alınmış")
    
    # Organizasyon bilgilerini getir (alıcı firma)
    org_owner = await db.users.find_one({"id": org_id}, {"_id": 0})
    if not org_owner:
        raise HTTPException(status_code=404, detail="Firma bilgileri bulunamadı")
    
    # Fatura HTML şablonu
    invoice_html = generate_invoice_html(car, org_owner)
    
    return HTMLResponse(content=invoice_html)


def generate_invoice_html(car: dict, buyer: dict) -> str:
    """
    Türkiye standartlarına uygun fatura HTML şablonu
    """
    
    # Tarih formatla
    invoice_date = car.get("invoice_date", datetime.now(timezone.utc).isoformat().split('T')[0])
    try:
        formatted_date = datetime.fromisoformat(invoice_date).strftime("%d/%m/%Y")
    except (ValueError, TypeError):
        formatted_date = invoice_date
    
    # Tutarları formatla
    purchase_price = car.get("purchase_price", 0)
    kdv_rate = 20  # %20 KDV (motorlu taşıtlar)
    kdv_amount = purchase_price * kdv_rate / 100
    total_amount = purchase_price + kdv_amount
    
    html = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fatura - {car.get('invoice_number', 'N/A')}</title>
    <style>
        @media print {{
            @page {{ margin: 1cm; }}
            body {{ margin: 0; }}
            .no-print {{ display: none; }}
        }}
        
        body {{
            font-family: 'Arial', sans-serif;
            max-width: 21cm;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
            color: #000;
        }}
        
        .header {{
            text-align: center;
            border-bottom: 3px solid #C9A961;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            margin: 0;
            color: #1a1a1a;
            font-size: 28px;
            font-weight: bold;
        }}
        
        .header .subtitle {{
            color: #C9A961;
            font-size: 14px;
            margin-top: 5px;
        }}
        
        .info-section {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            gap: 20px;
        }}
        
        .info-box {{
            flex: 1;
            border: 1px solid #ddd;
            padding: 15px;
            background: #f9f9f9;
        }}
        
        .info-box h3 {{
            margin: 0 0 10px 0;
            color: #1a1a1a;
            font-size: 14px;
            border-bottom: 2px solid #C9A961;
            padding-bottom: 5px;
        }}
        
        .info-box p {{
            margin: 5px 0;
            font-size: 12px;
            line-height: 1.6;
        }}
        
        .info-box strong {{
            display: inline-block;
            width: 120px;
        }}
        
        .invoice-details {{
            background: #fff;
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 20px;
        }}
        
        .invoice-details p {{
            margin: 5px 0;
            font-size: 13px;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        
        table th {{
            background: #1a1a1a;
            color: #fff;
            padding: 12px;
            text-align: left;
            font-size: 13px;
            font-weight: bold;
        }}
        
        table td {{
            padding: 12px;
            border-bottom: 1px solid #ddd;
            font-size: 12px;
        }}
        
        table tr:last-child td {{
            border-bottom: none;
        }}
        
        .totals {{
            margin-top: 20px;
            text-align: right;
        }}
        
        .totals table {{
            width: 400px;
            margin-left: auto;
        }}
        
        .totals td {{
            padding: 8px;
            font-size: 13px;
        }}
        
        .totals .total-row {{
            background: #1a1a1a;
            color: #fff;
            font-weight: bold;
            font-size: 15px;
        }}
        
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            font-size: 11px;
            color: #666;
        }}
        
        .print-button {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: #C9A961;
            color: #fff;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }}
        
        .print-button:hover {{
            background: #b39451;
        }}
    </style>
</head>
<body>
    <button class="print-button no-print" onclick="window.print()">🖨️ Yazdır / PDF</button>
    
    <div class="header">
        <h1>SATIŞ FATURASI</h1>
        <div class="subtitle">MOTORLU TAŞIT SATIŞ FATURASI</div>
    </div>
    
    <div class="info-section">
        <div class="info-box">
            <h3>SATICI BİLGİLERİ</h3>
            <p><strong>Ünvan:</strong> {car.get('invoice_seller_name', 'Belirtilmemiş')}</p>
            <p><strong>Vergi/TC No:</strong> {car.get('invoice_seller_tax_id', 'Belirtilmemiş')}</p>
            <p><strong>Adres:</strong> {car.get('invoice_seller_address', 'Belirtilmemiş')}</p>
        </div>
        
        <div class="info-box">
            <h3>ALICI BİLGİLERİ</h3>
            <p><strong>Ünvan:</strong> {buyer.get('company_name', 'MACTech')}</p>
            <p><strong>Telefon:</strong> {buyer.get('phone', 'Belirtilmemiş')}</p>
            <p><strong>Adres:</strong> {buyer.get('address', 'Belirtilmemiş')}</p>
        </div>
    </div>
    
    <div class="invoice-details">
        <p><strong>Fatura No:</strong> {car.get('invoice_number', 'Belirtilmemiş')}</p>
        <p><strong>Fatura Tarihi:</strong> {formatted_date}</p>
        <p><strong>Düzenleme Tarihi:</strong> {datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>ÜRÜN/HİZMET TANIMI</th>
                <th style="width: 100px;">MİKTAR</th>
                <th style="width: 120px;">BİRİM FİYAT</th>
                <th style="width: 120px;">TUTAR</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    <strong>{car.get('brand', '')} {car.get('model', '')}</strong><br>
                    <small>
                        Plaka: {car.get('plate', 'Belirtilmemiş').upper()} | 
                        Yıl: {car.get('year', 'N/A')} | 
                        Kilometre: {car.get('km', 'Belirtilmemiş')} | 
                        Yakıt: {car.get('fuel_type', 'Belirtilmemiş')} |
                        Vites: {car.get('gear', 'Belirtilmemiş')}
                    </small>
                </td>
                <td style="text-align: center;">1 Adet</td>
                <td style="text-align: right;">{purchase_price:,.2f} ₺</td>
                <td style="text-align: right;">{purchase_price:,.2f} ₺</td>
            </tr>
        </tbody>
    </table>
    
    <div class="totals">
        <table>
            <tr>
                <td><strong>Ara Toplam:</strong></td>
                <td style="text-align: right;">{purchase_price:,.2f} ₺</td>
            </tr>
            <tr>
                <td><strong>KDV (%{kdv_rate}):</strong></td>
                <td style="text-align: right;">{kdv_amount:,.2f} ₺</td>
            </tr>
            <tr class="total-row">
                <td><strong>GENEL TOPLAM:</strong></td>
                <td style="text-align: right;"><strong>{total_amount:,.2f} ₺</strong></td>
            </tr>
        </table>
    </div>
    
    <div class="footer">
        <p><strong>MACTech Oto Galeri CRM</strong></p>
        <p>Bu fatura elektronik ortamda oluşturulmuş olup, yasal geçerliliği bulunmaktadır.</p>
        <p style="margin-top: 10px; font-size: 10px;">
            Oluşturulma: {datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S")}
        </p>
    </div>
</body>
</html>
    """
    
    return html
