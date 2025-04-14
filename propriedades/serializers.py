from rest_framework import serializers
from .models import Propriedade

class PropriedadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Propriedade
        fields = ['codigo', 'tipo_imovel', 'cidade', 'estado', 'bairro',
                 'valor', 'latitude', 'longitude', 'desconto'] 