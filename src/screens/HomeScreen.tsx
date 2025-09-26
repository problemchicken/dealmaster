import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import {colors} from '../theme/colors';
import {useAuthStore} from '../store/useAuthStore';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {Deal, useDeals} from '../hooks/useDeals';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const logout = useAuthStore(state => state.logout);
  const {deals, loading, refreshing, refresh} = useDeals();

  const handleLogout = () => {
    logout();
  };

  const renderItem = ({item}: {item: Deal}) => (
    <View style={styles.dealCard}>
      <Text style={styles.dealTitle}>{item.title}</Text>
      <Text style={styles.dealDescription}>{item.description}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Fetching deals...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{"Today's Deals"}</Text>
        <PrimaryButton title="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
      <FlatList
        data={deals}
        keyExtractor={(item: Deal) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No deals available right now.</Text>
        }
      />
      <PrimaryButton title="Log Out" onPress={handleLogout} style={styles.logoutButton} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dealCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  dealDescription: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: colors.muted,
  },
  logoutButton: {
    margin: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
  },
});

export default HomeScreen;
