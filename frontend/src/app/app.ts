import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Producto {
  id: number;
  nombre: string;
  precio: string;
  descripcion: string | null;
  imagen: string | null;
  disponible: boolean;
}

interface DetallePedido {
  pedido_id: number;
  producto_id: number;
  producto: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
}

interface Pedido {
  id: number;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string;
  total: string;
  estado: string;
  fecha: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  private http = inject(HttpClient);

  // Registro de clientes (HU-01)
  nombreRegistro = '';
  correoRegistro = '';
  passwordRegistro = '';

  enviandoRegistro = signal(false);
  mensajeRegistro = signal('');
  errorRegistro = signal('');
  
  
  // Inicio de sesión de clientes (HU-02)
  correoLogin = '';
  passwordLogin = '';

  enviandoLogin = signal(false);
  mensajeLogin = signal('');
  errorLogin = signal('');

  clienteSesion = signal<{
    id: number;
    nombre: string;
    correo: string;
  } | null>(null);

   tokenSesion = signal<string | null>(null);

   pedidosCliente = signal<{
  id: number;
  total: number;
  estado: string;
  fecha: string;
}[]>([]);

  // Productos
  productos = signal<Producto[]>([]);
  cargando = signal(true);
  error = signal('');

  // Administración de productos (HU-08)
mostrarAdministracionProductos = signal(false);

nuevoNombreProducto = '';
nuevoPrecioProducto: number | null = null;

productoEditandoId = signal<number | null>(null);
nombreProductoEditando = '';
precioProductoEditando: number | null = null;

mensajeProductos = signal('');
errorProductos = signal('');

  // Carrito de compras
  carrito = signal<{ producto: Producto; cantidad: number }[]>([]);

  // Administración de pedidos
  pedidos = signal<Pedido[]>([]);
  cargandoPedidos = signal(false);
  errorPedidos = signal('');
  mostrarAdministracion = signal(false);

  // Detalle del pedido seleccionado
  pedidoSeleccionado = signal<number | null>(null);
  detallesPedido = signal<DetallePedido[]>([]);
  cargandoDetalle = signal(false);
  errorDetalle = signal('');

 // Agregar productos al carrito
agregarAlCarrito(producto: Producto): void {
  this.carrito.update(items => {
    const existente = items.find(
      item => item.producto.id === producto.id
    );

    if (existente) {
      return items.map(item =>
        item.producto.id === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      );
    }

    return [...items, { producto, cantidad: 1 }];
  });
}

  // Eliminar productos del carrito
  eliminarDelCarrito(id: number): void {
    this.carrito.update(items =>
      items.filter(item => item.producto.id !== id)
    );
  }

  // Aumentar la cantidad de un producto

  // Aumentar la cantidad de un producto
  aumentarCantidad(id: number): void {
    this.carrito.update(items =>
      items.map(item =>
        item.producto.id === id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      )
    );
  }

  // Disminuir la cantidad de un producto
  disminuirCantidad(id: number): void {
    this.carrito.update(items =>
      items.map(item =>
        item.producto.id === id && item.cantidad > 1
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      )
    );
  }


  // Calcular el subtotal de un producto
  subtotalItem(item: {
    producto: { precio: string | number };
    cantidad: number;
  }): number {
    return Number(item.producto.precio) * item.cantidad;
  }

  // Calcular total del carrito automáticamente
  // Calcular el total actual del carrito
  totalCarrito(): number {
    return this.carrito().reduce(
      (total, item) =>
        total + Number(item.producto.precio) * item.cantidad,
      0
    );
  }

  // Datos del cliente para realizar un pedido
  nombreCliente = '';
  telefonoCliente = '';
  direccionCliente = '';

  enviandoPedido = signal(false);
  mensajePedido = signal('');
  errorPedido = signal('');

  // Confirmar pedido
  confirmarPedido(): void {
    this.mensajePedido.set('');
    this.errorPedido.set('');

    if (
      !this.nombreCliente.trim() ||
      !this.telefonoCliente.trim() ||
      !this.direccionCliente.trim()
    ) {
      this.errorPedido.set(
        'Completa todos los datos del cliente.'
      );
      return;
    }

    if (this.carrito().length === 0) {
      this.errorPedido.set('Agrega productos al carrito.');
      return;
    }

    if (this.enviandoPedido()) {
      return;
    }

    const token = this.tokenSesion();

    if (!token) {
      this.errorPedido.set(
        'Inicia sesión antes de confirmar tu pedido.'
      );
      return;
    }

    const pedido = {
      nombre: this.nombreCliente.trim(),
      telefono: this.telefonoCliente.trim(),
      direccion: this.direccionCliente.trim(),
      productos: this.carrito().map(item => ({
        id: item.producto.id,
        cantidad: item.cantidad
      }))
    };

    this.enviandoPedido.set(true);

    this.http.post<{
      mensaje: string;
      pedido: { id: number; total: string };
    }>('/api/pedidos', pedido, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).subscribe({
      next: (respuesta) => {
        this.mensajePedido.set(
          `Pedido N.º ${respuesta.pedido.id} registrado. Total: S/ ${respuesta.pedido.total}`
        );

        this.carrito.set([]);
        this.nombreCliente = '';
        this.telefonoCliente = '';
        this.direccionCliente = '';
        this.enviandoPedido.set(false);
      },
      error: (error) => {
        console.error('Error al registrar pedido:', error);

        this.errorPedido.set(
          error.error?.mensaje ||
          'No se pudo registrar el pedido.'
        );

        this.enviandoPedido.set(false);
      }
    });
  }

  // Registrar cliente (HU-01)
  registrarCliente(): void {
    this.mensajeRegistro.set('');
    this.errorRegistro.set('');

    if (
      !this.nombreRegistro.trim() ||
      !this.correoRegistro.trim() ||
      !this.passwordRegistro
    ) {
      this.errorRegistro.set('Completa todos los campos.');
      return;
    }

    if (this.passwordRegistro.length < 8) {
      this.errorRegistro.set(
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    if (this.enviandoRegistro()) {
      return;
    }

    this.enviandoRegistro.set(true);

    this.http.post<{
      mensaje: string;
      cliente: {
        id: number;
        nombre: string;
        correo: string;
      };
    }>('/api/clientes/registro', {
      nombre: this.nombreRegistro.trim(),
      correo: this.correoRegistro.trim(),
      password: this.passwordRegistro
    }).subscribe({
      next: (respuesta) => {
        this.mensajeRegistro.set(respuesta.mensaje);

        this.nombreRegistro = '';
        this.correoRegistro = '';
        this.passwordRegistro = '';

        this.enviandoRegistro.set(false);
      },
      error: (error) => {
        this.errorRegistro.set(
          error.error?.mensaje ||
          'No se pudo crear la cuenta.'
        );

        this.enviandoRegistro.set(false);
      }
    });
  }

  
  // Iniciar sesión (HU-02)
  iniciarSesion(): void {
    this.mensajeLogin.set('');
    this.errorLogin.set('');

    if (
      !this.correoLogin.trim() ||
      !this.passwordLogin
    ) {
      this.errorLogin.set(
        'Ingresa tu correo y contraseña.'
      );
      return;
    }

    if (this.enviandoLogin()) {
      return;
    }

    this.enviandoLogin.set(true);

    this.http.post<{
      mensaje: string;
      token: string;
      cliente: {
        id: number;
        nombre: string;
        correo: string;
      };
    }>('/api/clientes/login', {
      correo: this.correoLogin.trim(),
      password: this.passwordLogin
    }).subscribe({
      next: (respuesta) => {
        this.clienteSesion.set(respuesta.cliente);
        this.tokenSesion.set(respuesta.token);
        this.mensajeLogin.set(
          `¡Bienvenido, ${respuesta.cliente.nombre}!`
        );

        this.correoLogin = '';
        this.passwordLogin = '';
        this.enviandoLogin.set(false);
      },
      error: (error) => {
        this.errorLogin.set(
          error.error?.mensaje ||
          'No se pudo iniciar sesión.'
        );

        this.enviandoLogin.set(false);
      }
    });
  }


  // Inicializar aplicación
  ngOnInit(): void {
    this.obtenerProductos();
  }

  // Obtener productos
  obtenerProductos(): void {
    this.http.get<Producto[]>('/api/productos').subscribe({
      next: (datos) => {
        this.productos.set(datos);
        this.cargando.set(false);
      },
      error: (error) => {
        console.error('Error al cargar productos:', error);
        this.error.set('No se pudieron cargar los productos.');
        this.cargando.set(false);
      }
    });
  }

  // Abrir administración
  abrirAdministracion(): void {
    this.mostrarAdministracion.set(true);
    this.obtenerPedidos();
  }

  // Volver a la tienda
  volverATienda(): void {
    this.mostrarAdministracion.set(false);
  }

  
  // Registrar un producto (HU-08)
  registrarProducto(): void {
    const nombre = this.nuevoNombreProducto.trim();
    const precio = Number(this.nuevoPrecioProducto);

    if (!nombre || this.nuevoPrecioProducto === null ||
        !Number.isFinite(precio) || precio <= 0) {
      this.errorProductos.set(
        'Ingresa un nombre y un precio válido.'
      );
      this.mensajeProductos.set('');
      return;
    }

    this.errorProductos.set('');
    this.mensajeProductos.set('');

    this.http.post<Producto>('/api/productos', {
      nombre,
      precio
    }).subscribe({
      next: () => {
        this.nuevoNombreProducto = '';
        this.nuevoPrecioProducto = null;
        this.mensajeProductos.set('Producto registrado correctamente.');
        this.obtenerProductos();
      },
      error: (error) => {
        console.error('Error al registrar producto:', error);
        this.errorProductos.set(
          error.error?.mensaje || 'No se pudo registrar el producto.'
        );
      }
    });
  }

  // Preparar la edición de un producto
  iniciarEdicionProducto(producto: Producto): void {
    this.productoEditandoId.set(producto.id);
    this.nombreProductoEditando = producto.nombre;
    this.precioProductoEditando = Number(producto.precio);
    this.mensajeProductos.set('');
    this.errorProductos.set('');
  }

  // Cancelar la edición
  cancelarEdicionProducto(): void {
    this.productoEditandoId.set(null);
    this.nombreProductoEditando = '';
    this.precioProductoEditando = null;
  }

  // Guardar los cambios de un producto
  guardarEdicionProducto(): void {
    const id = this.productoEditandoId();
    const nombre = this.nombreProductoEditando.trim();
    const precio = Number(this.precioProductoEditando);

    if (id === null || !nombre ||
        this.precioProductoEditando === null ||
        !Number.isFinite(precio) || precio <= 0) {
      this.errorProductos.set(
        'Ingresa un nombre y un precio válido.'
      );
      return;
    }

    this.errorProductos.set('');
    this.mensajeProductos.set('');

    this.http.put<Producto>(`/api/productos/${id}`, {
      nombre,
      precio
    }).subscribe({
      next: () => {
        this.cancelarEdicionProducto();
        this.mensajeProductos.set('Producto actualizado correctamente.');
        this.obtenerProductos();
      },
      error: (error) => {
        console.error('Error al actualizar producto:', error);
        this.errorProductos.set(
          error.error?.mensaje || 'No se pudo actualizar el producto.'
        );
      }
    });
  }

  // Eliminar un producto
  eliminarProducto(id: number): void {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) {
      return;
    }

    this.errorProductos.set('');
    this.mensajeProductos.set('');

    this.http.delete<{ mensaje: string }>(
      `/api/productos/${id}`
    ).subscribe({
      next: (respuesta) => {
        this.mensajeProductos.set(respuesta.mensaje);
        this.obtenerProductos();
      },
      error: (error) => {
        console.error('Error al eliminar producto:', error);
        this.errorProductos.set(
          error.error?.mensaje || 'No se pudo eliminar el producto.'
        );
      }
    });
  }

  // Obtener pedidos
  // Obtener pedidos con filtro por fecha
  obtenerPedidos(fecha?: string): void {
    this.cargandoPedidos.set(true);
    this.errorPedidos.set('');

    const url = fecha
      ? `/api/pedidos?fecha=${fecha}`
      : '/api/pedidos';

    this.http.get<Pedido[]>(url).subscribe({
      next: (datos) => {
        this.pedidos.set(datos);
        this.cargandoPedidos.set(false);
      },
      error: (error) => {
        console.error('Error al consultar pedidos:', error);
        this.errorPedidos.set(
          'No se pudieron cargar los pedidos.'
        );
        this.cargandoPedidos.set(false);
      }
    });
  }


  // Cambiar estado del pedido (HU-10)
  cambiarEstado(
    pedidoId: number,
    nuevoEstado: string
  ): void {
    this.http.put(
      `/api/pedidos/${pedidoId}/estado`,
      { estado: nuevoEstado }
    ).subscribe({
      next: () => {
        this.obtenerPedidos();
      },
      error: (error) => {
        console.error('Error al cambiar el estado:', error);

        this.errorPedidos.set(
          error.error?.mensaje ||
          'No se pudo actualizar el estado del pedido.'
        );
      }
    });
  }

  // Consultar detalle del pedido
  verDetalle(pedidoId: number): void {
    this.pedidoSeleccionado.set(pedidoId);
    this.detallesPedido.set([]);
    this.cargandoDetalle.set(true);
    this.errorDetalle.set('');

    this.http.get<DetallePedido[]>(
      `/api/pedidos/${pedidoId}/detalle`
    ).subscribe({
      next: (datos) => {
        this.detallesPedido.set(datos);
        this.cargandoDetalle.set(false);
      },
      error: (error) => {
        console.error('Error al consultar detalle:', error);

        this.errorDetalle.set(
          error.error?.mensaje ||
          'No se pudo cargar el detalle del pedido.'
        );

        this.cargandoDetalle.set(false);
      }
    });
  }

  // Cerrar detalle del pedido
  cerrarDetalle(): void {
    this.pedidoSeleccionado.set(null);
    this.detallesPedido.set([]);
    this.errorDetalle.set('');
    this.cargandoDetalle.set(false);
  }

   
  // HU-07: Consultar los pedidos del cliente
  consultarMisPedidos(): void {
    const token = this.tokenSesion();

    if (!token) {
      this.errorLogin.set('Inicia sesión para consultar tus pedidos.');
      return;
    }

    this.http.get<{
      mensaje: string;
      pedidos: {
        id: number;
        total: number;
        estado: string;
        fecha: string;
      }[];
    }>('/api/clientes/mis-pedidos', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).subscribe({
      next: (respuesta) => {
        this.pedidosCliente.set(respuesta.pedidos);
      },
      error: (error) => {
        console.error('Error al consultar mis pedidos:', error);
        this.errorLogin.set(
          error.error?.mensaje ||
          'No se pudieron consultar tus pedidos.'
        );
      }
    });
  }

}