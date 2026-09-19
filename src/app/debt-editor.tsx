import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { EditorHeader } from '@/components/editor-header';
import { ColorPicker, IconPicker, resolveIcon } from '@/components/icon-color-picker';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import {
  CATEGORY_COLORS,
  FALLBACK_CATEGORY_ID,
  categoriesForType,
  getCategories,
  type Category,
  type CategoryIcon,
} from '@/lib/categories';
import { addDebt, deleteDebt, getDebts, recordPayment, updateDebt, type Debt } from '@/lib/debts';


function parseNumber(text: string): number | null {
  const n = parseFloat(text);
  return Number.isNaN(n) || n < 0 ? null : n;
}

export default function DebtEditorScreen() {
  const theme = useTheme();
  const { format, symbol } = useCurrency();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [debt, setDebt] = useState<Debt | null>(null);
  const [loaded, setLoaded] = useState(!isEditing);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [originalBalance, setOriginalBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState<CategoryIcon | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [logPayments, setLogPayments] = useState(false);
  const [paymentCategoryId, setPaymentCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-reads just the debt record (and the balance field it drives) after a
  // payment — the other form fields are left alone so unsaved edits aren't
  // clobbered.
  async function reloadDebt(debtId: string) {
    const existing = (await getDebts()).find((d) => d.id === debtId) ?? null;
    setDebt(existing);
    if (existing) setBalance(String(existing.balance));
  }

  useEffect(() => {
    Promise.all([getDebts(), getCategories()]).then(([debts, loadedCategories]) => {
      setCategories(loadedCategories);
      if (!id) {
        // A fresh debt starts on the next unused palette slot rather than
        // always the first — the payoff chart stacks debts by color, so two
        // debts left on the same default would be indistinguishable there.
        setColor(CATEGORY_COLORS[debts.length % CATEGORY_COLORS.length]);
        return;
      }
      const existing = debts.find((d) => d.id === id) ?? null;
      setDebt(existing);
      if (existing) {
        setName(existing.name);
        setBalance(String(existing.balance));
        setOriginalBalance(String(existing.originalBalance));
        setApr(String(existing.apr));
        setMinPayment(String(existing.minPayment));
        setColor(existing.color);
        setIcon(existing.icon);
        setLogPayments(!!existing.logPayments);
        setPaymentCategoryId(existing.paymentCategoryId ?? null);
      }
      setLoaded(true);
    });
  }, [id]);

  const expenseCategories = categoriesForType(categories, 'expense');

  const parsedBalance = parseNumber(balance);
  const parsedApr = parseNumber(apr);
  const parsedMin = parseNumber(minPayment);
  // Starting balance is optional when adding — blank means "same as the
  // current balance", i.e. nothing paid down yet.
  const parsedOriginal = originalBalance.trim() === '' ? parsedBalance : parseNumber(originalBalance);
  const canSave =
    name.trim().length > 0 && parsedBalance !== null && parsedApr !== null && parsedMin !== null && parsedOriginal !== null;
  const displayIcon = resolveIcon(icon, name);
  const parsedPayment = parseFloat(paymentAmount);
  const canPay = !Number.isNaN(parsedPayment) && parsedPayment > 0;
  const paidDown = debt && debt.originalBalance > 0 ? 1 - debt.balance / debt.originalBalance : 0;

  async function handleSave() {
    if (!canSave || parsedBalance === null || parsedApr === null || parsedMin === null || parsedOriginal === null) return;
    const fields = {
      name: name.trim(),
      icon: displayIcon,
      color,
      balance: parsedBalance,
      // A balance above the recorded starting point (added interest, a new
      // charge) just moves the starting point up — progress shouldn't read
      // as negative.
      originalBalance: Math.max(parsedOriginal, parsedBalance),
      apr: parsedApr,
      minPayment: parsedMin,
    };
    if (isEditing && id) await updateDebt(id, fields);
    else await addDebt(fields);
    router.back();
  }

  async function handlePayment() {
    if (!id || !canPay) return;
    await recordPayment(id, parsedPayment);
    setPaymentAmount('');
    await reloadDebt(id);
  }

  // A new charge or added interest: raises the balance (and the starting
  // point with it, so progress never reads negative). Never logs a transaction.
  async function handleCharge() {
    if (!id || !debt || !canPay) return;
    const next = debt.balance + parsedPayment;
    await updateDebt(id, { balance: next, originalBalance: Math.max(debt.originalBalance, next) });
    setPaymentAmount('');
    await reloadDebt(id);
  }

  // The logging choice is saved as soon as it's changed, not on Save — a
  // payment can be recorded without ever tapping Save, and recordPayment
  // reads the choice off the stored record.
  async function handleToggleLogPayments(value: boolean) {
    if (!id) return;
    const fallback = expenseCategories.some((c) => c.id === FALLBACK_CATEGORY_ID.expense)
      ? FALLBACK_CATEGORY_ID.expense
      : (expenseCategories[0]?.id ?? null);
    const categoryId = paymentCategoryId ?? fallback;
    setLogPayments(value);
    setPaymentCategoryId(categoryId);
    await updateDebt(id, { logPayments: value, paymentCategoryId: categoryId ?? undefined });
  }

  async function handlePickPaymentCategory(categoryId: string) {
    if (!id) return;
    setPaymentCategoryId(categoryId);
    await updateDebt(id, { paymentCategoryId: categoryId });
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (id) await deleteDebt(id);
    router.back();
  }

  if (!loaded) return null;

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <EditorHeader
        title={name}
        onChangeTitle={setName}
        titlePlaceholder={isEditing ? 'Debt name' : 'New debt'}
        badge={<CategoryBadge category={{ icon: displayIcon, color }} size={30} />}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        {debt && (
          <View style={[styles.progressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.progressHeader}>
              <ThemedText type="small" themeColor="textSecondary">
                Paid down
              </ThemedText>
              <ThemedText type="smallBold">
                {format(Math.max(0, debt.originalBalance - debt.balance))} of {format(debt.originalBalance)}
              </ThemedText>
            </View>
            <ProgressBar percent={paidDown} color={color} type="income" />
            <ThemedText type="small" themeColor={debt.balance <= 0 ? 'success' : 'textSecondary'}>
              {debt.balance <= 0 ? 'Paid off' : `${format(debt.balance)} remaining`}
            </ThemedText>
          </View>
        )}

        {isEditing && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              ADJUST BALANCE
            </ThemedText>
            <View style={styles.payRow}>
              <View style={[styles.amountInputWrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <ThemedText type="default" themeColor="textSecondary">
                  {symbol}
                </ThemedText>
                <TextInput
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: theme.text }]}
                />
              </View>
              <Pressable
                onPress={handlePayment}
                disabled={!canPay}
                style={[styles.payButton, { backgroundColor: canPay ? theme.success : theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor={canPay ? undefined : 'textTertiary'} style={canPay && styles.payButtonText}>
                  Pay
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCharge}
                disabled={!canPay}
                style={[styles.payButton, { backgroundColor: canPay ? theme.destructive : theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor={canPay ? undefined : 'textTertiary'} style={canPay && styles.payButtonText}>
                  Add
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.logRow}>
              <View style={styles.logRowText}>
                <ThemedText type="small">Also log as a transaction</ThemedText>
                <ThemedText type="small" themeColor="textTertiary">
                  {logPayments
                    ? 'Each payment adds an expense dated today.'
                    : 'Only the balance changes. Turn on to add an expense too.'}
                </ThemedText>
              </View>
              <Switch
                value={logPayments}
                onValueChange={handleToggleLogPayments}
                trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
                thumbColor="#ffffff"
              />
            </View>
            {logPayments && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {expenseCategories.map((category) => {
                  const isSelected = category.id === paymentCategoryId;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => handlePickPaymentCategory(category.id)}
                      style={[
                        styles.categoryChip,
                        { borderColor: isSelected ? theme.destructive : theme.border },
                        isSelected && { backgroundColor: theme.destructive + '1A' },
                      ]}>
                      <CategoryBadge category={category} size={26} type="expense" />
                      <ThemedText type="small">{category.name}</ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.fieldRow}>
          <View style={[styles.field, styles.fieldHalf]}>
            <ThemedText type="small" themeColor="textSecondary">
              Current balance
            </ThemedText>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              placeholder="0.00"
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              style={inputStyle}
            />
          </View>
          <View style={[styles.field, styles.fieldHalf]}>
            <ThemedText type="small" themeColor="textSecondary">
              Starting balance
            </ThemedText>
            <TextInput
              value={originalBalance}
              onChangeText={setOriginalBalance}
              placeholder={balance || 'Same as current'}
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              style={inputStyle}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.field, styles.fieldHalf]}>
            <ThemedText type="small" themeColor="textSecondary">
              APR %
            </ThemedText>
            <TextInput
              value={apr}
              onChangeText={setApr}
              placeholder="19.99"
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              style={inputStyle}
            />
          </View>
          <View style={[styles.field, styles.fieldHalf]}>
            <ThemedText type="small" themeColor="textSecondary">
              Minimum / month
            </ThemedText>
            <TextInput
              value={minPayment}
              onChangeText={setMinPayment}
              placeholder="50"
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              style={inputStyle}
            />
          </View>
        </View>

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
            {isEditing ? 'Save changes' : 'Add debt'}
          </ThemedText>
        </Pressable>

        {isEditing && (
          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <MaterialIcons name="delete-outline" size={18} color={theme.destructive} />
            <ThemedText type="small" themeColor="destructive">
              {confirmingDelete ? 'Tap again to delete this debt' : 'Delete debt'}
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
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  fieldHalf: {
    flex: 1,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  progressCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payRow: {
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
  payButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderRadius: Spacing.two,
  },
  payButtonText: {
    color: '#ffffff',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  logRowText: {
    flex: 1,
    gap: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingRight: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
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
