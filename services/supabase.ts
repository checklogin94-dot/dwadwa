import { createClient } from '@supabase/supabase-js';
import { User, Product, Order, SupabaseResponse, UserRole, UserStatus, PixKeyType, DeliveryMethod, ChatMessage, DirectMessage } from '../types';

const SUPABASE_URL = 'https://owwntkcxtxwlfikqbsgx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93d250a2N4dHh3bGZpa3Fic2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDQ0NDksImV4cCI6MjA4NDQyMDQ0OX0.tD9DtaySwold-g7fCjz1DZXhGKZhxqTrog2MHWgZXnM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Mappers (Snake Case DB -> Camel Case App) ---

const mapUser = (profile: any): User => ({
  id: profile.id,
  email: profile.email,
  name: profile.name,
  role: (profile.role as UserRole) || 'buyer',
  status: (profile.status as UserStatus) || 'active',
  avatarUrl: profile.avatar_url,
  createdAt: profile.created_at,
});

const mapProduct = (item: any): Product => ({
  id: item.id,
  title: item.title,
  description: item.description,
  price: item.price,
  imageUrl: item.image_url,
  imagePath: item.image_path,
  city: item.city || 'Não informado',
  pixKey: item.pix_key || '',
  pixKeyType: (item.pix_key_type as PixKeyType) || 'RANDOM',
  quantity: (item.quantity !== null && item.quantity !== undefined) ? item.quantity : 1,
  deliveryMethod: (item.delivery_method as DeliveryMethod) || 'pickup', 
  sellerId: item.seller_id,
  sellerName: item.profiles?.name || item.seller_name || 'Vendedor',
  sellerAvatar: item.profiles?.avatar_url,
  createdAt: item.created_at,
});

const mapOrder = (item: any): Order => ({
  id: item.id,
  buyerId: item.buyer_id,
  buyerName: item.profiles?.name || 'Comprador',
  sellerId: item.seller_id,
  productId: item.product_id,
  productTitle: item.product_title,
  price: item.price,
  shippingAddress: item.shipping_address, // JSONB
  status: item.status || 'paid',
  createdAt: item.created_at,
});

const mapMessage = (item: any): ChatMessage => ({
    id: item.id,
    orderId: item.order_id,
    senderId: item.sender_id,
    content: item.content,
    createdAt: item.created_at
});

const mapDirectMessage = (item: any): DirectMessage => ({
    id: item.id,
    senderId: item.sender_id,
    receiverId: item.receiver_id,
    content: item.content,
    createdAt: item.created_at
});

// --- Service Interface ---

export const supabaseService = {
  auth: {
    signIn: async (email: string, password: string): Promise<SupabaseResponse<{ user: User; token: string }>> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error || !data.user) {
        return { data: null, error: error?.message || 'Login failed' };
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        const fallbackUser: User = {
           id: data.user.id,
           email: data.user.email!,
           name: data.user.user_metadata?.name || 'Unknown',
           role: (data.user.user_metadata?.role as UserRole) || 'buyer',
           status: 'active',
           createdAt: data.user.created_at
        };
        return { data: { user: fallbackUser, token: data.session?.access_token || '' }, error: null };
      }

      const mappedUser = mapUser(profile);

      if (mappedUser.status === 'suspended') {
        await supabase.auth.signOut();
        return { data: null, error: 'Account suspended. Contact administrator.' };
      }

      return { data: { user: mappedUser, token: data.session?.access_token || '' }, error: null };
    },

    signOut: async (): Promise<void> => {
      await supabase.auth.signOut();
    },

    getSession: async (): Promise<User | null> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        const user = mapUser(profile);
        if (user.status === 'suspended') {
            await supabase.auth.signOut();
            return null;
        }
        return user;
      }
      
      return {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.user_metadata?.name || 'User',
        role: (session.user.user_metadata?.role as UserRole) || 'buyer',
        status: 'active',
        createdAt: session.user.created_at
      };
    }
  },

  storage: {
    uploadImage: async (file: File, userId: string, bucket: string = 'product-images'): Promise<{ url: string; path: string } | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, file);

        if (uploadError) {
            console.error('Upload error', uploadError);
            if ((uploadError as any).statusCode === '404' || uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
                throw new Error(`ERRO CRÍTICO: O bucket '${bucket}' não existe no Supabase.`);
            }
            throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);
            
        return { url: data.publicUrl, path: fileName };
    }
  },

  db: {
    products: {
      getAll: async (): Promise<SupabaseResponse<Product[]>> => {
        try {
            const { data, error } = await supabase
              .from('products')
              .select('*, profiles:seller_id(name, avatar_url)')
              .order('created_at', { ascending: false });
            
            if (!error && data) {
                return { 
                    data: data.map(item => {
                        const product = mapProduct(item);
                        if (item.profiles && item.profiles.avatar_url) {
                            product.sellerAvatar = item.profiles.avatar_url;
                        }
                        return product;
                    }), 
                    error: null 
                };
            }

            const { data: products, error: prodError } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (prodError || !products) {
                return { data: null, error: prodError?.message || "Erro ao buscar produtos" };
            }

            const sellerIds = Array.from(new Set(products.map(p => p.seller_id).filter(Boolean)));
            let profilesMap: Record<string, any> = {};
            
            if (sellerIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, name, avatar_url') 
                    .in('id', sellerIds);
                
                if (profiles) {
                    profiles.forEach(p => profilesMap[p.id] = p);
                }
            }

            const mappedProducts = products.map(item => ({
                ...mapProduct(item),
                sellerName: profilesMap[item.seller_id]?.name || item.seller_name || 'Vendedor',
                sellerAvatar: profilesMap[item.seller_id]?.avatar_url
            }));

            return { data: mappedProducts, error: null };

        } catch (e: any) {
            return { data: null, error: e.message || 'Unknown error fetching products' };
        }
      },

      create: async (product: Omit<Product, 'id' | 'createdAt' | 'sellerName' | 'sellerAvatar'>, user: User): Promise<SupabaseResponse<Product>> => {
        const { data, error } = await supabase
          .from('products')
          .insert({
            title: product.title,
            description: product.description,
            price: product.price,
            image_url: product.imageUrl,
            image_path: product.imagePath,
            city: product.city,
            pix_key: product.pixKey,
            pix_key_type: product.pixKeyType,
            quantity: product.quantity,
            delivery_method: product.deliveryMethod,
            seller_id: user.id,
            seller_name: user.name
          })
          .select()
          .single();

        if (error) {
            return { data: null, error: error.message };
        }
        
        const newProduct = mapProduct(data);
        newProduct.sellerName = user.name;
        newProduct.sellerAvatar = user.avatarUrl;

        return { data: newProduct, error: null };
      },
      
      updateStock: async (productId: string, newQuantity: number): Promise<SupabaseResponse<void>> => {
        const { error } = await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', productId);
            
        if (error) return { data: null, error: error.message };
        return { data: null, error: null };
      },

      delete: async (productId: string): Promise<SupabaseResponse<void>> => {
          const { data: product, error: fetchError } = await supabase
              .from('products')
              .select('image_path, seller_id')
              .eq('id', productId)
              .single();

          if (fetchError) {
              return { data: null, error: "Erro: Anúncio não encontrado ou você não tem permissão para excluí-lo." };
          }

          const { error: dbError } = await supabase
              .from('products')
              .delete()
              .eq('id', productId);

          if (dbError) {
              return { data: null, error: `Erro ao excluir do banco: ${dbError.message}` };
          }

          if (product && product.image_path) {
              await supabase.storage.from('product-images').remove([product.image_path]);
          }
          
          return { data: null, error: null };
      }
    },
    
    orders: {
        create: async (order: Partial<Order>): Promise<SupabaseResponse<Order>> => {
            const { data, error } = await supabase.from('orders').insert({
                buyer_id: order.buyerId,
                seller_id: order.sellerId,
                product_id: order.productId,
                product_title: order.productTitle,
                price: order.price,
                shipping_address: order.shippingAddress,
                status: 'paid'
            }).select().single();
            
            if (error) return { data: null, error: error.message };
            return { data: mapOrder(data), error: null };
        },

        getForSeller: async (sellerId: string): Promise<SupabaseResponse<Order[]>> => {
            const { data, error } = await supabase
                .from('orders')
                .select('*, profiles:buyer_id(name)')
                .eq('seller_id', sellerId)
                .order('created_at', { ascending: false });

            if (error) return { data: null, error: error.message };
            return { data: data.map(mapOrder), error: null };
        },
        
        getForBuyer: async (buyerId: string): Promise<SupabaseResponse<Order[]>> => {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('buyer_id', buyerId)
                .order('created_at', { ascending: false });

            if (error) return { data: null, error: error.message };
            return { data: data.map(mapOrder), error: null };
        },

        markDelivered: async (orderId: string): Promise<SupabaseResponse<void>> => {
            // Update status
            const { error } = await supabase
                .from('orders')
                .update({ status: 'delivered' })
                .eq('id', orderId);

            if (error) return { data: null, error: error.message };
            
            // Delete chat messages as requested
            await supabase.from('messages').delete().eq('order_id', orderId);
            
            return { data: null, error: null };
        }
    },

    chat: {
        getMessages: async (orderId: string): Promise<SupabaseResponse<ChatMessage[]>> => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true });
                
            if (error) return { data: null, error: error.message };
            return { data: data.map(mapMessage), error: null };
        },

        sendMessage: async (orderId: string, senderId: string, content: string): Promise<SupabaseResponse<void>> => {
            const { error } = await supabase.from('messages').insert({
                order_id: orderId,
                sender_id: senderId,
                content: content
            });
            if (error) return { data: null, error: error.message };
            return { data: null, error: null };
        }
    },

    directChat: {
        getMessages: async (user1Id: string, user2Id: string): Promise<SupabaseResponse<DirectMessage[]>> => {
            const { data, error } = await supabase
                .from('direct_messages')
                .select('*')
                .or(`and(sender_id.eq.${user1Id},receiver_id.eq.${user2Id}),and(sender_id.eq.${user2Id},receiver_id.eq.${user1Id})`)
                .order('created_at', { ascending: true });
            
            if (error) return { data: null, error: error.message };
            return { data: data.map(mapDirectMessage), error: null };
        },

        sendMessage: async (senderId: string, receiverId: string, content: string): Promise<SupabaseResponse<void>> => {
            const { error } = await supabase.from('direct_messages').insert({
                sender_id: senderId,
                receiver_id: receiverId,
                content: content
            });
            if (error) return { data: null, error: error.message };
            return { data: null, error: null };
        },

        getContacts: async (userId: string): Promise<SupabaseResponse<User[]>> => {
            // Fetch messages where I am sender or receiver to find unique contacts
            const { data: sent, error: sentError } = await supabase
                .from('direct_messages')
                .select('receiver_id')
                .eq('sender_id', userId);
                
            const { data: received, error: recError } = await supabase
                .from('direct_messages')
                .select('sender_id')
                .eq('receiver_id', userId);

            if (sentError || recError) return { data: null, error: (sentError || recError)?.message || 'Error fetching contacts' };

            const contactIds = new Set<string>();
            sent?.forEach(msg => contactIds.add(msg.receiver_id));
            received?.forEach(msg => contactIds.add(msg.sender_id));

            if (contactIds.size === 0) return { data: [], error: null };

            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', Array.from(contactIds));

            if (profError) return { data: null, error: profError.message };
            
            return { data: profiles.map(mapUser), error: null };
        }
    },

    users: {
      getAll: async (): Promise<SupabaseResponse<User[]>> => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) return { data: null, error: error.message };
        return { data: data.map(mapUser), error: null };
      },

      create: async (userData: { name: string; email: string; role: UserRole; password?: string }): Promise<SupabaseResponse<User>> => {
        if (!userData.password) return { data: null, error: "Password required" };

        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: { 
              name: userData.name,
              role: userData.role,
              status: 'active'
            }
          }
        });

        if (authError) return { data: null, error: authError.message };
        if (!authData.user) return { data: null, error: "Failed to create auth user" };

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
             id: authData.user.id,
             email: userData.email,
             name: userData.name,
             role: userData.role,
             status: 'active',
             created_at: new Date().toISOString()
          });

        const newUser: User = {
            id: authData.user.id,
            email: userData.email!,
            name: userData.name,
            role: userData.role,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        
        return { data: newUser, error: null };
      },

      update: async (userId: string, updates: Partial<User>): Promise<SupabaseResponse<User>> => {
        const dbUpdates: any = {
             name: updates.name,
             role: updates.role,
             status: updates.status,
        };
        
        if (updates.avatarUrl !== undefined) {
            dbUpdates.avatar_url = updates.avatarUrl;
        }

        const { data, error } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (error) return { data: null, error: error.message };
        return { data: mapUser(data), error: null };
      },

      delete: async (userId: string): Promise<SupabaseResponse<void>> => {
        const { error } = await supabase.rpc('delete_user_account', { user_id: userId });
        if (error) return { data: null, error: error.message };
        return { data: null, error: null };
      }
    }
  }
};