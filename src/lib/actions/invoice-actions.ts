'use server'

import prisma from '@/lib/db'
import PDFDocument from 'pdfkit'
import { getAuthContext } from '@/lib/auth-utils'
import { checkFeature } from '@/lib/subscription-utils'

export async function generateInvoicePDF(orderId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasPDF = await checkFeature(activeFarmId, 'PDF_INVOICES')
  if (!hasPDF) {
    return { success: false, error: 'PDF Invoices require a Standard or Premium subscription' }
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: true,
        farm: true
      }
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    if (order.farmId !== activeFarmId) {
      return { success: false, error: 'Unauthorized' }
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 })
        const chunks: Buffer[] = []

        doc.on('data', (chunk) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', (err) => reject(err))

        // UI/UX PDF Design
        // Header
        const farmName = order.farm?.name?.toUpperCase() ?? 'AGRI-FARM'
        doc.fillColor('#444444').fontSize(20).text(farmName, 50, 50)
        doc.fontSize(10).text('Agri-ERP Commercial Suite', 50, 75)
        doc.text(`Date: ${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : new Date().toLocaleDateString()}`, 50, 90)
        doc.text(`Order ID: #${order.id}`, 50, 105)
        doc.moveDown()

        // Customer Info
        doc.fillColor('#000000').fontSize(12).text('BILL TO:', 50, 140)
        if (order.customer) {
          doc.fontSize(10).text(order.customer.name || 'Valued Customer', 50, 155)
          if (order.customer.phone) doc.text(`Phone: ${order.customer.phone}`, 50, 170)
          if (order.customer.address) doc.text(`Address: ${order.customer.address}`, 50, 185)
        } else {
          doc.fontSize(10).text('Walk-in Customer', 50, 155)
        }
        doc.moveDown()

        // Items Table Header
        const tableTop = 230
        doc.fillColor('#444444').fontSize(10).text('Description', 50, tableTop)
        doc.text('Quantity', 250, tableTop, { width: 90, align: 'right' })
        doc.text('Unit Price', 340, tableTop, { width: 90, align: 'right' })
        doc.text('Total', 430, tableTop, { width: 90, align: 'right' })

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#aaaaaa').stroke()

        // Items
        let i = 0
        const items = order.items || []
        items.forEach((item) => {
          const y = tableTop + 25 + (i * 25)
          doc.fillColor('#000000').text(item.description || 'Product Item', 50, y)
          doc.text((item.quantity || 0).toString(), 250, y, { width: 90, align: 'right' })
          doc.text(`GH₵${Number(item.unitPrice || 0).toFixed(2)}`, 340, y, { width: 90, align: 'right' })
          doc.text(`GH₵${Number(item.totalPrice || 0).toFixed(2)}`, 430, y, { width: 90, align: 'right' })
          i++
        })

        // Footer / Totals
        const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
        const footerTop = tableTop + 50 + (i * 25)

        doc.moveTo(350, footerTop).lineTo(550, footerTop).strokeColor('#aaaaaa').stroke()

        doc.fontSize(10).text('Subtotal:', 350, footerTop + 15)
        doc.text(`GH₵${subtotal.toFixed(2)}`, 430, footerTop + 15, { width: 90, align: 'right' })

        if (Number(order.discountAmount || 0) > 0) {
          doc.text(`Discount:`, 350, footerTop + 30)
          doc.text(`-GH₵${Number(order.discountAmount).toFixed(2)}`, 430, footerTop + 30, { width: 90, align: 'right' })
        }

        doc.fontSize(12).fillColor('#10b981').text('NET TOTAL:', 350, footerTop + 50)
        doc.text(`GH₵${Number(order.totalAmount || 0).toFixed(2)}`, 430, footerTop + 50, { width: 90, align: 'right' })

        doc.fontSize(10).fillColor('#444444').text(`Status: ${(order.status || 'PENDING').toUpperCase()}`, 50, footerTop + 50)

        doc.fontSize(8).text('Thank you for your business!', 50, 750, { align: 'center', width: 500 })

        doc.end()
      } catch (err) {
        reject(err)
      }
    })

    return {
      success: true,
      pdfBase64: pdfBuffer.toString('base64'),
      filename: `Invoice_${order.id}_${order.customer?.name?.replace(/\s+/g, '_') ?? 'WalkIn'}.pdf`
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    return { success: false, error: 'Failed to generate invoice' }
  }
}
