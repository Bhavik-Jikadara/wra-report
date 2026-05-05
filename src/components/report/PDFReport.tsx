import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { TurbinePosition, TurbineModel, EYASettings } from '@/types';
import { calculateEYA } from '@/lib/eya';

// Create styles
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#333' },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#111', fontWeight: 'bold' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, marginBottom: 10, color: '#1D9E75', borderBottom: '1 solid #1D9E75', paddingBottom: 4 },
  row: { flexDirection: 'row', borderBottom: '1 solid #eee', paddingVertical: 4 },
  colKey: { width: '40%', fontWeight: 'bold' },
  colVal: { width: '60%' },
  table: { display: 'flex', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { margin: 'auto', flexDirection: 'row' },
  tableColHeader: { width: '20%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: '#f3f4f6' },
  tableCol: { width: '20%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  tableCellHeader: { margin: 5, fontSize: 10, fontWeight: 'bold' },
  tableCell: { margin: 5, fontSize: 10 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#888', fontSize: 10, borderTop: '1 solid #eee', paddingTop: 10 }
});

interface PDFReportProps {
  turbines: TurbinePosition[];
  turbineModel: TurbineModel;
  eyaSettings: EYASettings;
  prevailingWindDir: number;
  boundaryAreaKm2?: string;
}

export const PDFReport = ({ turbines, turbineModel, eyaSettings, prevailingWindDir, boundaryAreaKm2 }: PDFReportProps) => {
  const eyaResults = calculateEYA(turbines, eyaSettings, turbineModel, prevailingWindDir);

  if (!eyaResults) return null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Energy Yield Assessment Report</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Overview</Text>
          <View style={styles.row}>
            <Text style={styles.colKey}>Project Area:</Text>
            <Text style={styles.colVal}>{boundaryAreaKm2 || '--'} km²</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colKey}>Number of WTGs:</Text>
            <Text style={styles.colVal}>{turbines.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colKey}>Turbine Model:</Text>
            <Text style={styles.colVal}>{turbineModel.oem} {turbineModel.model}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colKey}>Total Capacity:</Text>
            <Text style={styles.colVal}>{((turbineModel.ratedKW * turbines.length) / 1000).toFixed(2)} MW</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EYA Summary</Text>
          <View style={styles.row}>
            <Text style={styles.colKey}>Gross AEP:</Text>
            <Text style={styles.colVal}>{(eyaResults.summary.grossAepMwh / 1000).toFixed(2)} GWh/year</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colKey}>Net AEP (P50):</Text>
            <Text style={styles.colVal}>{(eyaResults.summary.netAepMwh / 1000).toFixed(2)} GWh/year</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colKey}>Net PLF:</Text>
            <Text style={styles.colVal}>{eyaResults.summary.plf.toFixed(2)} %</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colKey}>P75 / P90 / P99:</Text>
            <Text style={styles.colVal}>{(eyaResults.summary.p75 / 1000).toFixed(2)} / {(eyaResults.summary.p90 / 1000).toFixed(2)} / {(eyaResults.summary.p99 / 1000).toFixed(2)} GWh/year</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Turbine Layout Coordinates</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>ID</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Easting</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Northing</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Latitude</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Longitude</Text></View>
            </View>
            {turbines.slice(0, 10).map((t, i) => (
              <View style={styles.tableRow} key={i}>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{t.id}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{t.easting}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{t.northing}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{t.lat.toFixed(6)}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{t.lng.toFixed(6)}</Text></View>
              </View>
            ))}
          </View>
          {turbines.length > 10 && (
            <Text style={{ fontSize: 10, marginTop: 5, color: '#666' }}>* Only first 10 turbines shown in preview.</Text>
          )}
        </View>

        <Text style={styles.footer}>
          Generated by Wind Farm Micrositing Tool - {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
};
