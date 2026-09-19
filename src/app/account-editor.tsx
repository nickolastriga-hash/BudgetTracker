import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { EditorHeader } from '@/components/editor-header';
import { ColorPicker, IconPicker, resolveIcon } from '@/components/icon-color-picker';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_COLORS, type CategoryIcon } from '@/lib/categories';
import { addAccount, deleteAccount, getAccounts, updateAccount, type AccountKind } from '@/lib/net-worth';

// One net-worth line item — an asset (checking, savings, car, house) or a
// manual liability (a mortgage or loan not tracked as a payoff-plan debt).
// Reached from the Wealth tab's Net Worth page; `?kind=liability` presets
// the toggle when adding.
export default function AccountEditorScreen() {
  const theme = useTheme();
  const { symbol } = useCurrency();
  const insets = useSafeAreaInsets();
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const isEditing = !!id;

  const [loaded, setLoaded] = useState(!isEditing);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>(kindParam === 'liability' ? 'liability' : 'asset');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_COLORS[6]);
  const [icon, setIcon] = useState<CategoryIcon | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    getAccounts().then((accounts) => {
      if (!id) {
        // Next unused palette slot (starting from blue), same idea as
        // debt-editor and goal-editor.
        setColor(CATEGORY_COLORS[(6 + accounts.length) % CATEGORY_COLORS.length]);
        return;
      }
      const existing = accounts.find((a) => a.id === id);
      if (existing) {
        setName(existing.name);
        setKind(existing.kind);
        setBalance(String(existing.balance));
        setColor(existing.color);
        setIcon(existing.icon);
      }
      setLoaded(true);
    });
  }, [id]);

  const parsedBalance = parseFloat(balance);
  const canSave = name.trim().length > 0 && !Number.isNaN(parsedBalance) && parsedBalance >= 0;
  const displayIcon = resolveIcon(icon, name);

  async function handleSave() {
    if (!canSave) return;
    const fields = { name: name.trim(), icon: displayIcon, color, kind, balance: parsedBalance };
    if (isEditing && id) await updateAccount(id, fields);
    else await addAccount(fields);
    router.back();
  }

  // Add to or deduct from whatever the balance field currently shows, and
  // persist right away (like debt-editor's payment row) so it works without
  // tapping Save. Only the balance is written; other unsaved edits stay put.
  const parsedAdjust = parseFloat(adjustAmount);
  const canAdjust = isEditing && !Number.isNaN(parsedAdjust) && parsedAdjust > 0;
  async function handleAdjust(direction: 1 | -1) {
    if (!id || !canAdjust) return;
    const base = Number.isNaN(parsedBalance) ? 0 : parsedBalance;
    const next = Math.max(0, base + direction * parsedAdjust);
    await updateAccount(id, { balance: next });
    setBalance(String(Math.round(next * 100) / 100));
    setAdjustAmount('');
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (id) await deleteAccount(id);
    router.back();
  }

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <EditorHeader
        title={isEditing ? name || 'Edit Account' : kind === 'asset' ? 'New Asset' : 'New Liability'}
        badge={<CategoryBadge category={{ icon: displayIcon, color }} size={30} />}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        <SegmentedControl
          options={[
            { value: 'asset', label: 'Asset', icon: 'trending-up', color: theme.success },
            { value: 'liability', label: 'Liability', icon: 'trending-down', color: theme.destructive },
          ]}
          value={kind}
          onChange={setKind}
        />

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Name
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={kind === 'asset' ? 'Checking, Savings, Car, Home…' : 'Mortgage, Personal loan…'}
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            {kind === 'asset' ? 'Current value' : 'Amount owed'}
          </ThemedText>
          <TextInput
            value={balance}
            onChangeText={setBalance}
            placeholder="0.00"
            placeholderTextColor={theme.textTertiary}
            keyboardType="decimal-pad"
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          />
          <ThemedText type="small" themeColor="textTertiary">
            Update this by hand whenever it changes. There’s no bank sync.
          </ThemedText>
        </View>

        {isEditing && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              ADD OR DEDUCT
            </ThemedText>
            <View style={styles.adjustRow}>
              <View style={[styles.amountInputWrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <ThemedText type="default" themeColor="textSecondary">
                  {symbol}
                </ThemedText>
                <TextInput
                  value={adjustAmount}
                  onChangeText={setAdjustAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: theme.text }]}
                />
              </View>
              <Pressable
                onPress={() => handleAdjust(1)}
                disabled={!canAdjust}
                accessibilityLabel="Add to balance"
                style={[styles.adjustButton, { backgroundColor: canAdjust ? theme.success : theme.backgroundElement }]}>
                <MaterialIcons name="add" size={22} color={canAdjust ? '#ffffff' : theme.textTertiary} />
              </Pressable>
              <Pressable
                onPress={() => handleAdjust(-1)}
                disabled={!canAdjust}
                accessibilityLabel="Deduct from balance"
                style={[styles.adjustButton, { backgroundColor: canAdjust ? theme.destructive : theme.backgroundElement }]}>
                <MaterialIcons name="remove" size={22} color={canAdjust ? '#ffffff' : theme.textTertiary} />
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textTertiary">
              Changes the amount above right away. Or edit the amount directly to set a whole new value.
            </ThemedText>
          </View>
        )}

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Color
          </ThemedText>
          <ColorPicker value={color} onChange={setColor} />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Icon
          </ThemedText>
          <IconPicker value={icon} name={name} color={color} onChange={setIcon} />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor={canSave ? undefined : 'textTertiary'} style={canSave && styles.saveButtonText}>
            {isEditing ? 'Save changes' : kind === 'asset' ? 'Add asset' : 'Add liability'}
          </ThemedText>
        </Pressable>

        {isEditing && (
          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <MaterialIcons name="delete-outline" size={18} color={theme.destructive} />
            <ThemedText type="small" themeColor="destructive">
              {confirmingDelete ? 'Tap again to delete' : 'Delete'}
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  amountInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  amountInput: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: CardRadius,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
