import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.3,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  
  // Header Section
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: {
    width: '45%',
  },
  logo: {
    width: 140,
    height: 56,
    objectFit: 'contain',
    marginBottom: 6,
  },
  companyText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  companySubText: {
    fontSize: 8.5,
    marginBottom: 2,
  },
  titleContainer: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  headerRight: {
    width: '25%',
    alignItems: 'flex-end',
    paddingTop: 16,
  },
  expeditionRow: {
    flexDirection: 'row',
  },
  expeditionLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginRight: 4,
  },
  expeditionVal: {
    fontSize: 9,
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 15,
    marginTop: 4,
  },

  // Customer & Logistics Metadata Table
  infoTable: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  infoRowLast: {
    flexDirection: 'row',
    borderBottomWidth: 0,
  },
  infoColLabelFull: {
    width: '18%',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
  },
  infoColValFull: {
    width: '82%',
    padding: 4,
    fontSize: 8.5,
  },
  infoColLabelHalf: {
    width: '18%',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
  },
  infoColValHalf: {
    width: '32%',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    fontSize: 8.5,
  },
  infoColValHalfEnd: {
    width: '32%',
    padding: 4,
    fontSize: 8.5,
  },

  // Products Table
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 15,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7C8',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tableRowLast: {
    flexDirection: 'row',
    borderBottomWidth: 0,
  },
  tableColHeader: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
    padding: 4,
    textAlign: 'center',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  tableColHeaderEnd: {
    padding: 4,
    textAlign: 'center',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  tableCol: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
    padding: 4,
    fontSize: 8.5,
  },
  tableColEnd: {
    padding: 4,
    fontSize: 8.5,
  },

  // Column Width Specifications
  colPallet: { width: '10%', textAlign: 'center' },
  colLot: { width: '16%', textAlign: 'center' },
  colProduct: { width: '28%', textAlign: 'left' },
  colGGN: { width: '20%', textAlign: 'center' },
  colCaliber: { width: '10%', textAlign: 'center' },
  colBoxes: { width: '8%', textAlign: 'center' },
  colNet: { width: '8%', textAlign: 'center' },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
  },
  footerText: {
    fontSize: 8.5,
    marginBottom: 2,
    color: '#000000',
  },
});

export const PackingListPDF = ({ packingList, orderData, customerData, rows, logoUrl }: any) => {
  const customerName = orderData?.customerName || orderData?.customer || customerData?.name || packingList?.customer || '—';
  const customerAddress = orderData?.customerAddress || customerData?.address || packingList?.customerAddress || '—';
  const deliveryAddress = orderData?.deliveryAddress || customerData?.deliveryAddress || packingList?.deliveryAddress || '—';
  const orderGgn = orderData?.ggnNumber || packingList?.ggnNumber || '4063061946720';

  const totalNetWeight = packingList?.totalNetWeight || rows?.reduce((sum: number, r: any) => sum + (Number(r.netWeight ?? r.quantity) || 0), 0) || 0;
  const totalGrossWeight = packingList?.totalGrossWeight || rows?.reduce((sum: number, r: any) => sum + (Number(r.grossWeight) || 0), 0) || 0;

  const resolvedLogoUrl = logoUrl || (typeof window !== 'undefined' ? `${window.location.origin}/FFI_main.png` : '/FFI_main.png');

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Image src={resolvedLogoUrl} style={styles.logo} />
            <Text style={styles.companyText}>Export Optimum Sarl</Text>
            <Text style={styles.companySubText}>Douar Mouaraa Teyara Laouamra -Morocco</Text>
            <Text style={styles.companySubText}>RC52747</Text>
          </View>
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Packing list</Text>
          </View>
          
          <View style={styles.headerRight}>
            <View style={styles.expeditionRow}>
              <Text style={styles.expeditionLabel}>Expedition date:</Text>
              <Text style={styles.expeditionVal}>{packingList?.expeditionDate || '—'}</Text>
            </View>
          </View>
        </View>

        {/* HEADER DIVIDER LINE */}
        <View style={styles.headerDivider} />

        {/* CUSTOMER & LOGISTICS INFORMATION TABLE */}
        <View style={styles.infoTable}>
          
          {/* Row 1: Customer */}
          <View style={styles.infoRow}>
            <Text style={styles.infoColLabelFull}>Customer</Text>
            <Text style={styles.infoColValFull}>{customerName}</Text>
          </View>

          {/* Row 2: Address */}
          <View style={styles.infoRow}>
            <Text style={styles.infoColLabelFull}>Address</Text>
            <Text style={styles.infoColValFull}>{customerAddress}</Text>
          </View>

          {/* Row 3: Delivery Address */}
          <View style={styles.infoRow}>
            <Text style={styles.infoColLabelFull}>Delivery Address</Text>
            <Text style={styles.infoColValFull}>{deliveryAddress}</Text>
          </View>

          {/* Row 4: Transporter & Truck Number */}
          <View style={styles.infoRow}>
            <Text style={styles.infoColLabelHalf}>Transporter</Text>
            <Text style={styles.infoColValHalf}>{packingList?.transportCompany || '—'}</Text>
            <Text style={styles.infoColLabelHalf}>Truck number</Text>
            <Text style={styles.infoColValHalfEnd}>{packingList?.truckNumber || '—'}</Text>
          </View>

          {/* Row 5: PO Number & COC */}
          <View style={styles.infoRow}>
            <Text style={styles.infoColLabelHalf}>PO Number</Text>
            <Text style={styles.infoColValHalf}>{orderData?.poNumber || packingList?.poNumber || '—'}</Text>
            <Text style={styles.infoColLabelHalf}>COC</Text>
            <Text style={styles.infoColValHalfEnd}>4063651455366</Text>
          </View>

          {/* Row 6: Total Net Weight & Total Brut Weight */}
          <View style={styles.infoRowLast}>
            <Text style={styles.infoColLabelHalf}>Total Net Weight</Text>
            <Text style={styles.infoColValHalf}>{totalNetWeight ? `${totalNetWeight}KG` : '—'}</Text>
            <Text style={styles.infoColLabelHalf}>Total Brut Weight</Text>
            <Text style={styles.infoColValHalfEnd}>{totalGrossWeight ? `${totalGrossWeight}KG` : '—'}</Text>
          </View>

        </View>

        {/* ITEMS / CONTENTS TABLE */}
        <View style={styles.table}>
          
          {/* Header Row */}
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.tableColHeader, styles.colPallet]}>Pallet Number</Text>
            <Text style={[styles.tableColHeader, styles.colLot]}>Lot Number</Text>
            <Text style={[styles.tableColHeader, styles.colProduct]}>Product</Text>
            <Text style={[styles.tableColHeader, styles.colGGN]}>GGN Number</Text>
            <Text style={[styles.tableColHeader, styles.colCaliber]}>Caliber</Text>
            <Text style={[styles.tableColHeader, styles.colBoxes]}>Boxes</Text>
            <Text style={[styles.tableColHeaderEnd, styles.colNet]}>Net Weight (KG)</Text>
          </View>

          {/* Item Rows */}
          {rows?.map((row: any, idx: number) => {
            const isLast = idx === rows.length - 1;
            const rowStyle = isLast ? styles.tableRowLast : styles.tableRow;
            const productDisplay = row.product || '—';
            const boxesVal = row.numberOfBoxes ?? row.boxes ?? '—';
            const netWeightVal = row.netWeight ?? row.quantity ?? '—';

            return (
              <View key={idx} style={rowStyle} wrap={false}>
                <Text style={[styles.tableCol, styles.colPallet]}>{row.palletNumber || idx + 1}</Text>
                <Text style={[styles.tableCol, styles.colLot]}>{row.lotNumber || '—'}</Text>
                <Text style={[styles.tableCol, styles.colProduct]}>{productDisplay}</Text>
                <Text style={[styles.tableCol, styles.colGGN]}>{row.ggnNumber || orderGgn}</Text>
                <Text style={[styles.tableCol, styles.colCaliber]}>{row.caliber || row.calibre || '—'}</Text>
                <Text style={[styles.tableCol, styles.colBoxes]}>{boxesVal}</Text>
                <Text style={[styles.tableColEnd, styles.colNet]}>{netWeightVal}</Text>
              </View>
            );
          })}

        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Certified COC 4063651455366</Text>
          <Text style={styles.footerText}>GLOBALG.A.P. certified product with GGN : {orderGgn}</Text>
        </View>

      </Page>
    </Document>
  );
};


