import { View, Text, StyleSheet } from 'react-native';
import { BIN_COLOURS, BIN_LABELS, type BinType } from '../lib/colours';
import { THEME } from '../lib/theme';

interface BinCardProps {
  binType: BinType;
  size?: 'small' | 'large';
}

export function BinCard({ binType, size = 'large' }: BinCardProps) {
  const colour = BIN_COLOURS[binType];
  const label = BIN_LABELS[binType];
  const isLarge = size === 'large';

  return (
    <View style={[styles.card, isLarge ? styles.cardLarge : styles.cardSmall]}>
      {/* Bin icon */}
      <View style={[styles.bin, isLarge ? styles.binLarge : styles.binSmall]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colour }]} />
        {/* Lid */}
        <View style={[styles.lid, { backgroundColor: colour }, isLarge ? styles.lidLarge : styles.lidSmall]} />
        {/* Body */}
        <View style={[styles.body, isLarge ? styles.bodyLarge : styles.bodySmall]} />
      </View>
      {isLarge && (
        <Text style={styles.label}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLarge: {
    padding: 10,
    margin: 6,
    backgroundColor: THEME.bgCardLight,
    borderRadius: 18,
    width: 100,
    height: 115,

    // Duolingo-style bottom border for 3D pop
    borderBottomWidth: 4,
    borderBottomColor: '#1E5038',
  },
  cardSmall: {
    padding: 6,
    margin: 3,
  },
  bin: {
    alignItems: 'center',
  },
  binLarge: {
    width: 48,
    height: 64,
  },
  binSmall: {
    width: 32,
    height: 44,
  },
  handle: {
    width: 16,
    height: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: -1,
  },
  lid: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  lidLarge: {
    height: 10,
  },
  lidSmall: {
    height: 8,
  },
  body: {
    backgroundColor: '#444444',
    width: '90%',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  bodyLarge: {
    height: 40,
  },
  bodySmall: {
    height: 28,
  },
  label: {
    fontWeight: '700',
    color: THEME.textSecondary,
    textAlign: 'center',
    fontSize: 11,
    marginTop: 4,
  },
});
